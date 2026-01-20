/**
 * normalizr - Normalizes and denormalizes JSON according to schema
 *
 * @packageDocumentation
 */

/**
 * Note on .js extensions in imports:
 *
 * TypeScript with "moduleResolution": "bundler" or "NodeNext" requires
 * import paths to use the OUTPUT file extension (.js), not the source
 * extension (.ts). This is because:
 *
 * 1. TypeScript doesn't rewrite import paths during compilation
 * 2. The runtime (Node.js or bundler) sees the compiled .js files
 * 3. Using .js ensures the imports work in the final build output
 *
 * The TypeScript compiler is smart enough to resolve './foo.js' to
 * './foo.ts' during type-checking, while emitting './foo.js' in the
 * output. This is the standard approach for ESM TypeScript projects.
 */

// Main functions
export { normalize } from './normalize.js';
export { denormalize } from './denormalize.js';

// Schema classes
import EntitySchema from './schemas/Entity.js';
import ArraySchema from './schemas/Array.js';
import ObjectSchema from './schemas/Object.js';
import UnionSchema from './schemas/Union.js';
import ValuesSchema from './schemas/Values.js';

/**
 * Schema namespace containing all schema constructors.
 *
 * @example
 * ```typescript
 * import { schema } from 'normalizr';
 *
 * const user = new schema.Entity('users');
 * const article = new schema.Entity('articles', { author: user });
 * ```
 */
export const schema = {
  Array: ArraySchema,
  Entity: EntitySchema,
  Object: ObjectSchema,
  Union: UnionSchema,
  Values: ValuesSchema,
};

// Also export schema classes individually for direct imports
export { default as EntitySchema } from './schemas/Entity.js';
export { default as ArraySchema } from './schemas/Array.js';
export { default as ObjectSchema } from './schemas/Object.js';
export { default as UnionSchema } from './schemas/Union.js';
export { default as ValuesSchema } from './schemas/Values.js';
export { default as PolymorphicSchema } from './schemas/Polymorphic.js';

// Export types for consumers
export type {
  // Core types
  IdType,
  Schema,
  SchemaClass,
  SchemaDefinition,
  SchemaFunction,
  SchemaAttribute,
  SchemaAttributeFn,

  // Entity options
  EntityOptions,
  IdAttribute,
  IdAttributeFn,
  MergeStrategy,
  ProcessStrategy,
  FallbackStrategy,

  // Normalization types
  EntitiesMap,
  NormalizedSchema,
  VisitedEntities,

  // Denormalization types
  DenormalizeOptions,
  CreateUnvisitFn,
  UnvisitFn,
  GetEntityFn,

  // Internal types (useful for extensions)
  VisitFn,
  AddEntityFn,
  EntitySchemaInterface,

  // Type inference utilities
  Denormalized,
  Normalized,
  AllEntitiesOf,
  EntityLike,
  NormalizedEntity,
  UnionToIntersection,
} from './types.js';
