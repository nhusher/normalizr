import { PolymorphicSchema } from './Polymorphic.js';
import type { Schema, SchemaAttribute, VisitFn, AddEntityFn, VisitedEntities, UnvisitFn } from '../types.js';

/**
 * Union schema for normalizing polymorphic data.
 *
 * This is useful when you have a single field that can contain different
 * types of entities, determined by some attribute on the data.
 *
 * Unlike Array and Values which handle collections of potentially different types,
 * Union handles a single value that could be one of several types.
 */
export class UnionSchema<
  TDefinition extends Record<string, Schema> = Record<string, Schema>,
> extends PolymorphicSchema<TDefinition> {
  /**
   * Create a new Union schema.
   *
   * @param definition - A mapping of schema keys to schemas
   * @param schemaAttribute - Required attribute to determine which schema to use
   */
  constructor(definition: TDefinition, schemaAttribute: SchemaAttribute) {
    if (!schemaAttribute) {
      throw new Error('Expected option "schemaAttribute" not found on UnionSchema.');
    }
    super(definition, schemaAttribute);
  }

  /**
   * Normalize a single polymorphic value.
   */
  normalize(
    input: unknown,
    parent: unknown,
    key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): unknown {
    return this.normalizeValue(input, parent, key ?? '', visit, addEntity, visitedEntities);
  }

  /**
   * Denormalize a single polymorphic value.
   */
  denormalize(input: unknown, unvisit: UnvisitFn): unknown {
    return this.denormalizeValue(input, unvisit);
  }
}

export default UnionSchema;
