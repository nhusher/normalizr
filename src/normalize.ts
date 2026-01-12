import * as ArrayUtils from './schemas/Array.js';
import * as ObjectUtils from './schemas/Object.js';
import { hasOwn } from './utils/hasOwn.js';
import type {
  Schema,
  SchemaClass,
  SchemaDefinition,
  EntitiesMap,
  NormalizedSchema,
  VisitFn,
  AddEntityFn,
  VisitedEntities,
  EntitySchemaInterface,
} from './types.js';

/**
 * Check if a schema has a normalize method (is a schema class).
 */
function isSchemaClass(schema: Schema): schema is SchemaClass {
  return (
    typeof schema === 'object' && schema !== null && 'normalize' in schema && typeof schema.normalize === 'function'
  );
}

/**
 * Visit a value and normalize it according to its schema.
 *
 * @param value - The value to normalize
 * @param parent - The parent object
 * @param key - The key of the value in the parent
 * @param schema - The schema to use for normalization
 * @param addEntity - Function to add entities to the store
 * @param visitedEntities - Tracking for circular references
 * @returns The normalized value
 */
const visit: VisitFn = (value, parent, key, schema, addEntity, visitedEntities) => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  // Handle shorthand syntax for arrays and objects
  if (!isSchemaClass(schema)) {
    if (Array.isArray(schema)) {
      return ArrayUtils.normalize(schema, value, parent, key, visit, addEntity, visitedEntities);
    }
    // Cast justified: not array and not SchemaClass, so must be object shorthand { key: schema }
    return ObjectUtils.normalize(schema as SchemaDefinition, value, parent, key, visit, addEntity, visitedEntities);
  }

  return schema.normalize(value, parent, key, visit, addEntity, visitedEntities);
};

/**
 * Create an addEntity function that adds entities to the entities store.
 *
 * @param entities - The entities store to add to
 * @returns An addEntity function
 */
const addEntities =
  (entities: EntitiesMap): AddEntityFn =>
  (
    schema: EntitySchemaInterface,
    processedEntity: Record<string, unknown>,
    value: unknown,
    parent: unknown,
    key: string | undefined,
  ) => {
    const schemaKey = schema.key;
    const id = schema.getId(value, parent, key);

    if (!hasOwn(entities, schemaKey)) {
      entities[schemaKey] = {};
    }

    if (hasOwn(entities[schemaKey], id)) {
      const existingEntity = entities[schemaKey][id];
      // Cast justified: entities store contains Record<string, unknown> values
      entities[schemaKey][id] = schema.merge(existingEntity as Record<string, unknown>, processedEntity);
    } else {
      entities[schemaKey][id] = processedEntity;
    }
  };

/**
 * Normalize input data according to a schema.
 *
 * Takes nested data and flattens it into an entities store, with
 * references replaced by their IDs.
 *
 * @typeParam TSchema - The schema type
 * @typeParam TEntities - The entities map type (inferred)
 * @typeParam TResult - The result type (inferred)
 *
 * @param input - The data to normalize (must be an object or array)
 * @param schema - The schema describing the data structure
 * @returns An object with `entities` and `result` properties
 *
 * @example
 * ```typescript
 * const user = new schema.Entity('users');
 * const article = new schema.Entity('articles', { author: user });
 *
 * const data = {
 *   id: '123',
 *   title: 'My Article',
 *   author: { id: '1', name: 'Paul' }
 * };
 *
 * const { entities, result } = normalize(data, article);
 * // result: '123'
 * // entities: {
 * //   articles: { '123': { id: '123', title: 'My Article', author: '1' } },
 * //   users: { '1': { id: '1', name: 'Paul' } }
 * // }
 * ```
 */
export function normalize<TSchema extends Schema>(
  input: unknown,
  schema: TSchema,
): NormalizedSchema<EntitiesMap, unknown> {
  if (!input || typeof input !== 'object') {
    throw new Error(
      `Unexpected input given to normalize. Expected type to be "object", found "${
        input === null ? 'null' : typeof input
      }".`,
    );
  }

  const entities: EntitiesMap = {};
  const addEntity = addEntities(entities);
  const visitedEntities: VisitedEntities = {};

  const result = visit(input, input, undefined, schema, addEntity, visitedEntities);

  return { entities, result };
}

export default normalize;
