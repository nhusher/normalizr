import EntitySchema from './schemas/Entity.js';
import * as ArrayUtils from './schemas/Array.js';
import * as ObjectUtils from './schemas/Object.js';
import { isImmutable } from './utils/immutable.js';
import { hasOwn } from './utils/hasOwn.js';
import type {
  Schema,
  SchemaClass,
  SchemaDefinition,
  EntitiesMap,
  UnvisitFn,
  GetEntityFn,
  CreateUnvisitFn,
  DenormalizeOptions,
  IdType,
  EntitySchemaInterface,
} from './types.js';

/**
 * Check if a schema has a denormalize method (is a schema class).
 */
function isSchemaClass(schema: Schema): schema is SchemaClass {
  return (
    typeof schema === 'object' && schema !== null && 'denormalize' in schema && typeof schema.denormalize === 'function'
  );
}

/**
 * Denormalize an entity by ID.
 *
 * @param id - The entity ID
 * @param schema - The entity schema
 * @param unvisit - The unvisit function for recursive denormalization
 * @param getEntity - Function to get entities from the store
 * @param cache - Cache for denormalized entities (handles circular refs)
 * @param inProgress - Set of entity keys currently being denormalized (for circular ref detection)
 * @returns The denormalized entity
 */
function unvisitEntity(
  id: IdType,
  schema: EntitySchema,
  unvisit: UnvisitFn,
  getEntity: GetEntityFn,
  cache: Record<string, Record<IdType, unknown>>,
  inProgress: Set<string>,
): unknown {
  let entity = getEntity(id, schema);

  // Try fallback if entity is missing
  if (entity === undefined && schema instanceof EntitySchema) {
    // Cast justified: fallback returns TData which extends Record<string, unknown>
    entity = schema.fallback(id, schema) as Record<string, unknown> | undefined;
  }

  if (typeof entity !== 'object' || entity === null) {
    return entity;
  }

  // Initialize cache for this entity type
  if (!hasOwn(cache, schema.key)) {
    cache[schema.key] = {};
  }

  const cacheKey = `${schema.key}:${id}`;

  // Check for circular reference
  if (inProgress.has(cacheKey)) {
    if (isImmutable(entity)) {
      throw new Error(
        `Circular reference detected for Immutable.js entity "${schema.key}" with ID "${id}". ` +
          `Circular references are not supported with Immutable.js.`,
      );
    }
    // For plain objects, return the cached (in-progress) copy.
    // It will be fully populated by the time the outer denormalize completes
    // because Entity.denormalize mutates in place.
    return cache[schema.key][id];
  }

  // Return cached version if already fully denormalized
  if (hasOwn(cache[schema.key], id)) {
    return cache[schema.key][id];
  }

  // Mark as in-progress before denormalizing
  inProgress.add(cacheKey);

  // Create a shallow copy to avoid mutating the original entities store.
  // For Immutable.js objects, we skip the copy since they're immutable anyway.
  const entityCopy = isImmutable(entity) ? entity : { ...entity };

  // Store the copy in the cache BEFORE denormalizing. For plain objects,
  // this ensures that circular references will find this same object,
  // which will be mutated in place during denormalization.
  cache[schema.key][id] = entityCopy;

  // Denormalize the entity. For plain objects, this mutates entityCopy
  // in place. For Immutable.js, this returns a new object, which is why
  // we throw on circular references above.
  cache[schema.key][id] = schema.denormalize(entityCopy, unvisit);

  // Mark as complete
  inProgress.delete(cacheKey);

  return cache[schema.key][id];
}

/**
 * Create a function to get entities from the store.
 *
 * @param entities - The entities store
 * @returns A function that retrieves entities by ID and schema
 */
function getEntities(entities: EntitiesMap): GetEntityFn {
  const isImmutableEntities = isImmutable(entities);

  return (entityOrId: IdType | Record<string, unknown>, schema: EntitySchemaInterface) => {
    const schemaKey = schema.key;

    // If already an object, return as-is (partially denormalized)
    if (typeof entityOrId === 'object') {
      return entityOrId;
    }

    if (isImmutableEntities) {
      // Cast justified: isImmutable check confirms this has Immutable.js getIn method
      return (entities as unknown as { getIn(path: string[]): Record<string, unknown> | undefined }).getIn([
        schemaKey,
        entityOrId.toString(),
      ]);
    }

    // Use hasOwn to avoid prototype pollution (e.g., id = "constructor")
    if (!hasOwn(entities, schemaKey)) {
      return undefined;
    }
    const entityStore = entities[schemaKey];
    if (!hasOwn(entityStore, entityOrId)) {
      return undefined;
    }
    // Cast justified: entities store values are entity objects (Record<string, unknown>)
    return entityStore[entityOrId] as Record<string, unknown>;
  };
}

/**
 * Create the default eager unvisit function.
 *
 * This immediately resolves all nested entities recursively.
 *
 * @param _entities - The entities store (unused in eager mode, available for custom implementations)
 * @param getEntity - Function to get entities from the store
 * @returns An unvisit function for denormalization
 */
const createEagerUnvisit: CreateUnvisitFn = (_entities, getEntity) => {
  const cache: Record<string, Record<IdType, unknown>> = {};
  const inProgress = new Set<string>();

  const unvisit: UnvisitFn = (input, schema) => {
    // Handle shorthand syntax for arrays and objects
    if (!isSchemaClass(schema)) {
      if (Array.isArray(schema)) {
        return ArrayUtils.denormalize(schema, input, unvisit);
      }
      // Cast justified: not array and not SchemaClass, so must be object shorthand { key: schema }
      return ObjectUtils.denormalize(schema as SchemaDefinition, input, unvisit);
    }

    if (input === undefined || input === null) {
      return input;
    }

    // Entity schemas need special handling for ID lookup
    if (schema instanceof EntitySchema) {
      // Cast justified: for entity schemas, input is the entity ID from normalized result
      return unvisitEntity(input as IdType, schema, unvisit, getEntity, cache, inProgress);
    }

    return schema.denormalize(input, unvisit);
  };

  return unvisit;
};

/**
 * Denormalize data according to a schema.
 *
 * Takes normalized data (flat entities + result) and reconstructs
 * the nested structure.
 *
 * @typeParam TSchema - The schema type
 * @typeParam TEntities - The entities map type
 *
 * @param input - The normalized result (usually IDs or ID references)
 * @param schema - The schema describing the data structure
 * @param entities - The entities store from normalization
 * @param options - Optional configuration (e.g., custom unvisit for lazy denormalization)
 * @returns The denormalized data
 *
 * @example
 * ```typescript
 * const user = new schema.Entity('users');
 * const article = new schema.Entity('articles', { author: user });
 *
 * const entities = {
 *   articles: { '123': { id: '123', title: 'My Article', author: '1' } },
 *   users: { '1': { id: '1', name: 'Paul' } }
 * };
 *
 * const result = denormalize('123', article, entities);
 * // { id: '123', title: 'My Article', author: { id: '1', name: 'Paul' } }
 * ```
 *
 * @example Custom unvisit function
 * ```typescript
 * const result = denormalize('123', article, entities, {
 *   createUnvisit: (entities, getEntity) => {
 *     // Return a custom unvisit function
 *     return myCustomUnvisit;
 *   }
 * });
 * ```
 */
export function denormalize<TSchema extends Schema, TEntities extends EntitiesMap>(
  input: unknown,
  schema: TSchema,
  entities: TEntities,
  options?: DenormalizeOptions<TEntities>,
): unknown {
  if (typeof input === 'undefined') {
    return input;
  }

  const getEntity = getEntities(entities);
  const createUnvisit = options?.createUnvisit ?? createEagerUnvisit;
  const unvisit = createUnvisit(entities, getEntity);

  return unvisit(input, schema);
}

export default denormalize;
