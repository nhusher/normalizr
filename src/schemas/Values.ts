import { PolymorphicSchema } from './Polymorphic.js';
import type { Schema, SchemaAttribute, VisitFn, AddEntityFn, VisitedEntities, UnvisitFn } from '../types.js';

/**
 * Values schema for normalizing object maps where values are entities.
 *
 * This is useful when you have an object like { "key1": entity1, "key2": entity2 }
 * and want to normalize each value.
 *
 * Can work with:
 * 1. A single schema for all values
 * 2. A mapping of schemas selected by a schemaAttribute (polymorphic)
 */
export class ValuesSchema<TDefinition extends Schema = Schema> extends PolymorphicSchema<TDefinition> {
  /**
   * Create a new Values schema.
   *
   * @param definition - A single schema or a mapping of schemas
   * @param schemaAttribute - Optional attribute to determine which schema to use
   */
  constructor(definition: TDefinition, schemaAttribute?: SchemaAttribute) {
    super(definition, schemaAttribute);
  }

  /**
   * Normalize an object's values.
   */
  normalize(
    input: unknown,
    _parent: unknown,
    _key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): Record<string, unknown> {
    // Cast justified: Values schema operates on object maps
    const typedInput = input as Record<string, unknown>;

    return Object.keys(typedInput).reduce(
      (output, inputKey) => {
        const value = typedInput[inputKey];

        if (value !== undefined && value !== null) {
          return {
            ...output,
            [inputKey]: this.normalizeValue(value, typedInput, inputKey, visit, addEntity, visitedEntities),
          };
        }

        return output;
      },
      // Cast justified: empty object accumulator, will be populated by reduction
      {} as Record<string, unknown>,
    );
  }

  /**
   * Denormalize an object's values.
   */
  denormalize(input: unknown, unvisit: UnvisitFn): Record<string, unknown> {
    // Cast justified: Values schema operates on object maps from normalized store
    const typedInput = input as Record<string, unknown>;

    return Object.keys(typedInput).reduce(
      (output, inputKey) => {
        const entityOrId = typedInput[inputKey];

        return {
          ...output,
          [inputKey]: this.denormalizeValue(entityOrId, unvisit),
        };
      },
      // Cast justified: empty object accumulator, will be populated by reduction
      {} as Record<string, unknown>,
    );
  }
}

export default ValuesSchema;
