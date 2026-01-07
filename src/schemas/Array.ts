import { PolymorphicSchema } from './Polymorphic.js';
import type { Schema, SchemaAttribute, VisitFn, AddEntityFn, VisitedEntities, UnvisitFn } from '../types.js';

/**
 * Validate that a schema definition is a single schema (or array with one element).
 */
function validateSchema(definition: Schema | readonly Schema[]): Schema {
  if (Array.isArray(definition)) {
    if (definition.length > 1) {
      throw new Error(`Expected schema definition to be a single schema, but found ${definition.length}.`);
    }
    // Cast justified: array branch confirmed, definition[0] is the schema element
    return definition[0] as Schema;
  }
  // Cast justified: not an array, so definition is already a Schema
  return definition as Schema;
}

/**
 * Get values from an input, handling both arrays and objects.
 */
function getValues(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  // Cast justified: not an array, so input must be an object (normalize validates this)
  return Object.keys(input as object).map((key) => (input as Record<string, unknown>)[key]);
}

/**
 * Normalize an array using shorthand syntax [schema].
 *
 * @param schema - The schema definition (as an array with one element)
 * @param input - The input array or object to normalize
 * @param parent - The parent object
 * @param key - The key of the input in the parent
 * @param visit - The visit function for recursive normalization
 * @param addEntity - Function to add entities to the store
 * @param visitedEntities - Tracking for circular references
 * @returns The normalized array of values
 */
export function normalize(
  schema: Schema | readonly Schema[],
  input: unknown,
  parent: unknown,
  key: string | undefined,
  visit: VisitFn,
  addEntity: AddEntityFn,
  visitedEntities: VisitedEntities,
): unknown[] {
  const validatedSchema = validateSchema(schema);
  const values = getValues(input);

  // Special case: Arrays pass *their* parent on to their children, since there
  // is not any special information that can be gathered from themselves directly
  return values.map((value) => visit(value, parent, key, validatedSchema, addEntity, visitedEntities));
}

/**
 * Denormalize an array using shorthand syntax [schema].
 *
 * @param schema - The schema definition (as an array with one element)
 * @param input - The normalized array to denormalize
 * @param unvisit - The unvisit function for recursive denormalization
 * @returns The denormalized array
 */
export function denormalize(
  schema: Schema | readonly Schema[],
  input: unknown,
  unvisit: UnvisitFn,
): unknown[] | unknown {
  const validatedSchema = validateSchema(schema);
  // Cast justified: input is either an array or Immutable.List (both have .map)
  const arrayInput = input as unknown[] | { map?: (fn: (v: unknown) => unknown) => unknown[] };

  if (arrayInput && typeof arrayInput.map === 'function') {
    return arrayInput.map((entityOrId: unknown) => unvisit(entityOrId, validatedSchema));
  }
  return input;
}

/**
 * Array schema for normalizing arrays of entities.
 *
 * Can work with:
 * 1. A single schema for all array elements
 * 2. A mapping of schemas selected by a schemaAttribute (polymorphic)
 *
 * If the input is an Object instead of an Array, it will normalize the Object's values.
 */
export class ArraySchema<TDefinition extends Schema = Schema> extends PolymorphicSchema<TDefinition> {
  /**
   * Create a new Array schema.
   *
   * @param definition - A single schema or a mapping of schemas
   * @param schemaAttribute - Optional attribute to determine which schema to use
   */
  constructor(definition: TDefinition, schemaAttribute?: SchemaAttribute) {
    super(definition, schemaAttribute);
  }

  /**
   * Normalize an array of values.
   */
  normalize(
    input: unknown,
    parent: unknown,
    key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): unknown[] {
    const values = getValues(input);

    return values
      .map((value) => this.normalizeValue(value, parent, key ?? '', visit, addEntity, visitedEntities))
      .filter((value) => value !== undefined && value !== null);
  }

  /**
   * Denormalize an array of values.
   */
  denormalize(input: unknown, unvisit: UnvisitFn): unknown[] | unknown {
    // Cast justified: input is either an array or Immutable.List (both have .map)
    const arrayInput = input as unknown[] | { map?: (fn: (v: unknown) => unknown) => unknown[] };

    if (arrayInput && typeof arrayInput.map === 'function') {
      return arrayInput.map((value: unknown) => this.denormalizeValue(value, unvisit));
    }
    return input;
  }
}

export default ArraySchema;
