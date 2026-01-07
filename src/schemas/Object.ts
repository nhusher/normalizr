import { isImmutable, denormalizeImmutable } from '../utils/immutable.js';
import type {
  Schema,
  SchemaDefinition,
  VisitFn,
  AddEntityFn,
  VisitedEntities,
  UnvisitFn,
  SchemaFunction,
} from '../types.js';

/**
 * Normalize an object using shorthand syntax { key: schema }.
 *
 * @param schema - The schema definition mapping keys to schemas
 * @param input - The input object to normalize
 * @param parent - The parent object
 * @param key - The key of the input in the parent
 * @param visit - The visit function for recursive normalization
 * @param addEntity - Function to add entities to the store
 * @param visitedEntities - Tracking for circular references
 * @returns The normalized object
 */
export function normalize(
  schema: SchemaDefinition,
  input: unknown,
  _parent: unknown,
  _key: string | undefined,
  visit: VisitFn,
  addEntity: AddEntityFn,
  visitedEntities: VisitedEntities,
): Record<string, unknown> {
  // Cast justified: normalize() is called with objects matching the schema shape
  const typedInput = input as Record<string, unknown>;
  const object: Record<string, unknown> = { ...typedInput };

  Object.keys(schema).forEach((schemaKey) => {
    const localSchema = schema[schemaKey];
    // Cast justified: Schema type includes SchemaFunction; narrowing after typeof check
    const resolvedLocalSchema: Schema =
      typeof localSchema === 'function' ? (localSchema as SchemaFunction)(typedInput) : localSchema;

    const value = visit(typedInput[schemaKey], typedInput, schemaKey, resolvedLocalSchema, addEntity, visitedEntities);

    if (value === undefined || value === null) {
      delete object[schemaKey];
    } else {
      object[schemaKey] = value;
    }
  });

  return object;
}

/**
 * Denormalize an object using shorthand syntax { key: schema }.
 *
 * @param schema - The schema definition mapping keys to schemas
 * @param input - The normalized object to denormalize
 * @param unvisit - The unvisit function for recursive denormalization
 * @returns The denormalized object
 */
export function denormalize(schema: SchemaDefinition, input: unknown, unvisit: UnvisitFn): unknown {
  if (isImmutable(input)) {
    // Cast justified: SchemaDefinition is Record<string, Schema>
    return denormalizeImmutable(schema as Record<string, Schema>, input, unvisit);
  }

  // Cast justified: denormalize() receives objects from the normalized store
  const typedInput = input as Record<string, unknown>;
  const object: Record<string, unknown> = { ...typedInput };

  Object.keys(schema).forEach((schemaKey) => {
    if (object[schemaKey] != null) {
      object[schemaKey] = unvisit(object[schemaKey], schema[schemaKey]);
    }
  });

  return object;
}

/**
 * Object schema for normalizing plain objects with nested entities.
 *
 * Note: The same behavior can be achieved with shorthand syntax: { key: schema }
 */
export class ObjectSchema<TDefinition extends SchemaDefinition = SchemaDefinition> {
  /**
   * The schema definition mapping keys to schemas.
   */
  public schema: TDefinition;

  /**
   * Create a new Object schema.
   *
   * @param definition - A mapping of keys to schemas
   */
  constructor(definition: TDefinition) {
    // Cast justified: {} satisfies SchemaDefinition, will be populated by define()
    this.schema = {} as TDefinition;
    this.define(definition);
  }

  /**
   * Define or extend the schema definition.
   * This method is useful for creating circular references.
   *
   * @param definition - The schema definition to merge
   */
  define(definition: Partial<TDefinition>): void {
    this.schema = Object.keys(definition).reduce(
      (entitySchema, key) => {
        // Cast justified: Object.keys() returns string[], but key came from definition
        const schema = definition[key as keyof typeof definition];
        return { ...entitySchema, [key]: schema };
      },
      // Cast justified: accumulator maintains TDefinition shape through reduction
      this.schema || ({} as TDefinition),
    );
  }

  /**
   * Normalize an object.
   */
  normalize(
    input: unknown,
    parent: unknown,
    key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): Record<string, unknown> {
    return normalize(this.schema, input, parent, key, visit, addEntity, visitedEntities);
  }

  /**
   * Denormalize an object.
   */
  denormalize(input: unknown, unvisit: UnvisitFn): unknown {
    return denormalize(this.schema, input, unvisit);
  }
}

export default ObjectSchema;
