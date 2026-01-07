import { isImmutable, denormalizeImmutable } from '../utils/immutable.js';
import type {
  Schema,
  SchemaDefinition,
  EntityOptions,
  IdAttribute,
  IdType,
  MergeStrategy,
  ProcessStrategy,
  FallbackStrategy,
  VisitFn,
  AddEntityFn,
  VisitedEntities,
  UnvisitFn,
  EntitySchemaInterface,
  SchemaFunction,
} from '../types.js';

/**
 * Get the default ID getter function for a string idAttribute.
 */
function getDefaultGetId<T>(idAttribute: string): (input: T, parent: unknown, key: string | undefined) => IdType {
  return (input: T) => {
    if (isImmutable(input)) {
      // Cast justified: isImmutable() confirms this has Immutable.js's .get() method
      return (input as unknown as { get(key: string): IdType }).get(idAttribute);
    }
    // Cast justified: T is constrained to object types, accessing property by string key
    return (input as Record<string, IdType>)[idAttribute];
  };
}

/**
 * Entity schema for normalizing objects with an ID.
 *
 * @typeParam TKey - The literal string key for this entity type (e.g., 'users')
 * @typeParam TData - The full entity data type
 * @typeParam TDefinition - The nested schema definition
 */
export class EntitySchema<
  TKey extends string = string,
  TData extends Record<string, unknown> = Record<string, unknown>,
  TDefinition extends SchemaDefinition = SchemaDefinition,
> implements EntitySchemaInterface {
  private _key: TKey;
  private _idAttribute: IdAttribute<TData>;
  private _getId: (input: TData, parent: unknown, key: string | undefined) => IdType;
  private _mergeStrategy: MergeStrategy<Record<string, unknown>>;
  private _processStrategy: ProcessStrategy<TData>;
  private _fallbackStrategy: FallbackStrategy<TData>;

  /**
   * The nested schema definition for this entity.
   */
  public schema: TDefinition;

  /**
   * Create a new Entity schema.
   *
   * @param key - The key name under which all entities of this type will be listed
   * @param definition - A definition of the nested entities found within this entity
   * @param options - Configuration options for the entity
   */
  constructor(
    key: TKey,
    // Cast justified: {} satisfies SchemaDefinition, TDefinition defaults to SchemaDefinition
    definition: TDefinition = {} as TDefinition,
    options: EntityOptions<TData> = {},
  ) {
    if (!key || typeof key !== 'string') {
      throw new Error(`Expected a string key for Entity, but found ${key}.`);
    }

    const {
      idAttribute = 'id',
      mergeStrategy = (entityA, entityB) => ({ ...entityA, ...entityB }),
      processStrategy = (input) => ({ ...input }),
      fallbackStrategy = () => undefined,
    } = options;

    this._key = key;
    this._idAttribute = idAttribute;
    this._getId = typeof idAttribute === 'function' ? idAttribute : getDefaultGetId<TData>(idAttribute);
    // Cast justified: TData extends Record<string, unknown>, so this is a widening cast
    this._mergeStrategy = mergeStrategy as MergeStrategy<Record<string, unknown>>;
    this._processStrategy = processStrategy;
    this._fallbackStrategy = fallbackStrategy;
    // Cast justified: {} satisfies SchemaDefinition, will be populated by define()
    this.schema = {} as TDefinition;
    this.define(definition);
  }

  /**
   * The key name for this entity type.
   */
  get key(): TKey {
    return this._key;
  }

  /**
   * The idAttribute configuration for this entity.
   */
  get idAttribute(): IdAttribute<TData> {
    return this._idAttribute;
  }

  /**
   * Define or extend the nested schema definition.
   * This method is useful for creating circular references.
   *
   * **Note**: When using `define()` for circular references, TypeScript cannot
   * infer the full type. For proper type inference, explicitly declare an
   * interface for your entity type:
   *
   * @example
   * ```typescript
   * interface User {
   *   id: string;
   *   friends: User[];
   * }
   *
   * const userSchema = new schema.Entity<'users', User, { friends: typeof userSchema[] }>('users');
   * userSchema.define({ friends: [userSchema] });
   * ```
   *
   * @param definition - The schema definition to merge
   */
  define(definition: Partial<TDefinition>): void {
    this.schema = Object.keys(definition).reduce(
      (entitySchema, key) => {
        // Cast justified: Object.keys() returns string[], but we know key came from definition
        const schema = definition[key as keyof typeof definition];
        return { ...entitySchema, [key]: schema };
      },
      // Cast justified: accumulator starts with existing schema or empty object matching TDefinition shape
      this.schema || ({} as TDefinition),
    );
  }

  /**
   * Get the ID for an entity.
   */
  getId(input: unknown, parent: unknown, key: string | undefined): IdType {
    // Cast justified: callers pass entity data; we accept unknown for interface compatibility
    return this._getId(input as TData, parent, key);
  }

  /**
   * Merge two entities with the same ID.
   */
  merge(existingEntity: Record<string, unknown>, newEntity: Record<string, unknown>): Record<string, unknown> {
    return this._mergeStrategy(existingEntity, newEntity);
  }

  /**
   * Get a fallback entity when one is missing during denormalization.
   */
  fallback(id: IdType, schema: EntitySchemaInterface): TData | undefined {
    return this._fallbackStrategy(id, schema);
  }

  /**
   * Validate that input is a non-null object suitable for normalization.
   *
   * Override this method to implement custom validation logic, e.g.,
   * checking for required fields or validating against a schema.
   *
   * @param input - The input to validate
   * @returns The validated input as TData
   * @throws Error if the input is not a valid object
   */
  validate(input: unknown): TData {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(
        `Expected an object for entity "${this.key}", but received ${
          input === null ? 'null' : Array.isArray(input) ? 'an array' : typeof input
        }.`,
      );
    }
    return input as TData;
  }

  /**
   * Normalize an entity, extracting nested entities and replacing them with IDs.
   */
  normalize(
    input: unknown,
    parent: unknown,
    key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): IdType {
    const typedInput = this.validate(input);
    const id = this.getId(typedInput, parent, key);
    const entityType = this.key;

    // Track visited entities to handle circular references
    if (!(entityType in visitedEntities)) {
      visitedEntities[entityType] = {};
    }
    if (!(id in visitedEntities[entityType])) {
      visitedEntities[entityType][id] = [];
    }
    if (visitedEntities[entityType][id].some((entity) => entity === typedInput)) {
      return id;
    }
    visitedEntities[entityType][id].push(typedInput);

    // Process the entity (transform, add defaults, etc.)
    // Cast justified: processStrategy returns TData, but we need to mutate it as a generic record
    const processedEntity = this._processStrategy(typedInput, parent, key) as Record<string, unknown>;

    // Visit nested schemas
    Object.keys(this.schema).forEach((schemaKey) => {
      if (
        Object.prototype.hasOwnProperty.call(processedEntity, schemaKey) &&
        typeof processedEntity[schemaKey] === 'object'
      ) {
        // Cast justified: Object.keys() returns string[], but schemaKey is from this.schema
        const nestedSchema = this.schema[schemaKey as keyof TDefinition] as Schema;
        // Cast justified: Schema includes SchemaFunction, narrowing after typeof check
        const resolvedSchema: Schema =
          typeof nestedSchema === 'function' ? (nestedSchema as SchemaFunction)(typedInput) : nestedSchema;
        processedEntity[schemaKey] = visit(
          processedEntity[schemaKey],
          processedEntity,
          schemaKey,
          resolvedSchema,
          addEntity,
          visitedEntities,
        );
      }
    });

    addEntity(this, processedEntity, typedInput, parent, key);
    return id;
  }

  /**
   * Denormalize an entity, replacing IDs with full nested objects.
   *
   * **Warning**: For plain objects, this method mutates the input `entity`
   * directly rather than creating a copy. Callers should pass a copy if
   * the original must be preserved.
   */
  denormalize(entity: unknown, unvisit: UnvisitFn): TData {
    // Cast justified: denormalize receives entity data from the entities store
    const typedEntity = entity as Record<string, unknown>;

    if (isImmutable(typedEntity)) {
      // Cast justified: TDefinition extends SchemaDefinition which is Record<string, Schema>
      // Return cast justified: denormalizeImmutable returns the same structure as TData
      return denormalizeImmutable(this.schema as Record<string, Schema>, typedEntity, unvisit) as TData;
    }

    // Visit nested schemas and replace IDs with denormalized entities
    Object.keys(this.schema).forEach((schemaKey) => {
      if (Object.prototype.hasOwnProperty.call(typedEntity, schemaKey)) {
        // Cast justified: Object.keys() returns string[], but schemaKey is from this.schema
        const nestedSchema = this.schema[schemaKey as keyof TDefinition] as Schema;
        typedEntity[schemaKey] = unvisit(typedEntity[schemaKey], nestedSchema);
      }
    });

    // Cast justified: we've denormalized in place, structure matches TData
    return typedEntity as TData;
  }
}

export default EntitySchema;
