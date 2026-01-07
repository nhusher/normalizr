import { isImmutable } from '../utils/immutable.js';
import type {
  Schema,
  SchemaAttribute,
  SchemaAttributeFn,
  VisitFn,
  AddEntityFn,
  VisitedEntities,
  UnvisitFn,
} from '../types.js';

/**
 * Base class for polymorphic schemas (Array, Union, Values).
 *
 * Polymorphic schemas can work with either:
 * 1. A single schema for all values
 * 2. A mapping of schemas selected by a schemaAttribute
 */
export class PolymorphicSchema<TDefinition extends Schema = Schema> {
  /**
   * The schema definition - either a single schema or a mapping.
   */
  public schema: TDefinition;

  /**
   * Function to get the schema attribute from a value.
   */
  protected _schemaAttribute?: SchemaAttributeFn;

  /**
   * Create a new polymorphic schema.
   *
   * @param definition - A single schema or a mapping of schemas
   * @param schemaAttribute - Optional attribute to determine which schema to use
   */
  constructor(definition: TDefinition, schemaAttribute?: SchemaAttribute) {
    if (schemaAttribute) {
      this._schemaAttribute =
        typeof schemaAttribute === 'string'
          ? (input: unknown) =>
              // Cast justified: schemaAttribute selects a property; input is an entity object
              (input as Record<string, string>)[schemaAttribute]
          : schemaAttribute;
    }
    this.schema = definition;
  }

  /**
   * Whether this schema uses a single schema for all values.
   */
  get isSingleSchema(): boolean {
    return !this._schemaAttribute;
  }

  /**
   * Define or replace the schema definition.
   *
   * @param definition - The new schema definition
   */
  define(definition: TDefinition): void {
    this.schema = definition;
  }

  /**
   * Get the schema attribute value for a given input.
   *
   * @param input - The input value
   * @param parent - The parent object
   * @param key - The key of the input in the parent
   * @returns The schema attribute value, or false if single schema
   */
  getSchemaAttribute(input: unknown, parent: unknown, key: string): string | false {
    return !this.isSingleSchema && this._schemaAttribute!(input, parent, key);
  }

  /**
   * Infer which schema to use for a given input.
   *
   * @param input - The input value
   * @param parent - The parent object
   * @param key - The key of the input in the parent
   * @returns The schema to use
   */
  inferSchema(input: unknown, parent: unknown, key: string): Schema | undefined {
    if (this.isSingleSchema) {
      // Cast justified: when isSingleSchema is true, TDefinition is a single Schema
      return this.schema as Schema;
    }

    const attr = this.getSchemaAttribute(input, parent, key);
    if (attr === false) {
      return undefined;
    }
    // Cast justified: when !isSingleSchema, TDefinition is a schema mapping object
    return (this.schema as Record<string, Schema>)[attr];
  }

  /**
   * Normalize a single value using the appropriate schema.
   *
   * @param value - The value to normalize
   * @param parent - The parent object
   * @param key - The key of the value in the parent
   * @param visit - The visit function for recursive normalization
   * @param addEntity - Function to add entities to the store
   * @param visitedEntities - Tracking for circular references
   * @returns The normalized value
   */
  normalizeValue(
    value: unknown,
    parent: unknown,
    key: string,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): unknown {
    const schema = this.inferSchema(value, parent, key);
    if (!schema) {
      return value;
    }

    const normalizedValue = visit(value, parent, key, schema, addEntity, visitedEntities);

    if (this.isSingleSchema || normalizedValue === undefined || normalizedValue === null) {
      return normalizedValue;
    }

    // For polymorphic schemas with multiple types, include the schema key
    return {
      id: normalizedValue,
      schema: this.getSchemaAttribute(value, parent, key),
    };
  }

  /**
   * Denormalize a single value using the appropriate schema.
   *
   * @param value - The value to denormalize (may be an ID or object with id/schema)
   * @param unvisit - The unvisit function for recursive denormalization
   * @returns The denormalized value
   */
  denormalizeValue(value: unknown, unvisit: UnvisitFn): unknown {
    // Cast justified: polymorphic normalized values have { id, schema } shape or are Immutable
    const schemaKey = isImmutable(value)
      ? (value as { get(key: string): string }).get('schema')
      : (value as { schema?: string })?.schema;

    if (!this.isSingleSchema && !schemaKey) {
      return value;
    }

    // Cast justified: same shape as above - extracting id from normalized polymorphic reference
    const id = this.isSingleSchema
      ? undefined
      : isImmutable(value)
        ? (value as { get(key: string): unknown }).get('id')
        : (value as { id?: unknown })?.id;

    // Cast justified: isSingleSchema check determines which branch of TDefinition we have
    const schema = this.isSingleSchema ? (this.schema as Schema) : (this.schema as Record<string, Schema>)[schemaKey!];

    return unvisit(id ?? value, schema);
  }
}

export default PolymorphicSchema;
