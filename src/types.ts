/**
 * Core type definitions for normalizr
 */

// ============================================================================
// Basic Types
// ============================================================================

/**
 * The type of entity IDs.
 *
 * Note: While IDs in your source data may be numbers, JavaScript coerces
 * all object keys to strings, so IDs in the entities store are always strings.
 */
export type IdType = string;

/**
 * A function that extracts a schema attribute from a value.
 */
export type SchemaAttributeFn = (value: unknown, parent: unknown, key: string) => string;

/**
 * Schema attribute can be a string key or a function.
 */
export type SchemaAttribute = string | SchemaAttributeFn;

// ============================================================================
// Schema Interface
// ============================================================================

/**
 * Base interface for all schema types.
 * TInput is the denormalized (nested) type.
 * TOutput is the normalized (flat) type.
 */
export interface SchemaClass<TInput = unknown, TOutput = unknown> {
  normalize(
    input: unknown,
    parent: unknown,
    key: string | undefined,
    visit: VisitFn,
    addEntity: AddEntityFn,
    visitedEntities: VisitedEntities,
  ): TOutput;

  denormalize(input: unknown, unvisit: UnvisitFn): TInput;

  // Phantom types for type inference
  readonly _inputType?: TInput;
  readonly _outputType?: TOutput;
}

/**
 * A schema definition can be a schema class, an array of schemas, or an object mapping.
 */
export type Schema = SchemaClass | readonly [Schema] | { [key: string]: Schema } | SchemaFunction;

/**
 * A function that returns a schema based on the parent value.
 * Used for dynamic schema selection.
 */
export type SchemaFunction = (parent: unknown) => Schema;

/**
 * Schema definition for entities - maps keys to nested schemas.
 */
export type SchemaDefinition = Record<string, Schema>;

// ============================================================================
// Normalization Context Types
// ============================================================================

/**
 * Tracks visited entities to handle circular references.
 */
export type VisitedEntities = Record<string, Record<IdType, unknown[]>>;

/**
 * Function to visit and normalize a value.
 */
export type VisitFn = (
  value: unknown,
  parent: unknown,
  key: string | undefined,
  schema: Schema,
  addEntity: AddEntityFn,
  visitedEntities: VisitedEntities,
) => unknown;

/**
 * Function to add an entity to the entities store.
 */
export type AddEntityFn = (
  schema: EntitySchemaInterface,
  processedEntity: Record<string, unknown>,
  value: unknown,
  parent: unknown,
  key: string | undefined,
) => void;

/**
 * Interface for entity schemas (used by AddEntityFn).
 */
export interface EntitySchemaInterface {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  idAttribute: string | ((value: any, parent: any, key: string | undefined) => IdType);
  getId(value: unknown, parent: unknown, key: string | undefined): IdType;
  merge(existingEntity: Record<string, unknown>, newEntity: Record<string, unknown>): Record<string, unknown>;
}

// ============================================================================
// Denormalization Context Types
// ============================================================================

/**
 * Function to get an entity from the entities store.
 */
export type GetEntityFn = (
  entityOrId: IdType | Record<string, unknown>,
  schema: EntitySchemaInterface,
) => Record<string, unknown> | undefined;

/**
 * Function to unvisit (denormalize) a value.
 */
export type UnvisitFn = (input: unknown, schema: Schema) => unknown;

/**
 * Factory function to create an unvisit function.
 */
export type CreateUnvisitFn<TEntities = unknown> = (entities: TEntities, getEntity: GetEntityFn) => UnvisitFn;

/**
 * Options for the denormalize function.
 */
export interface DenormalizeOptions<TEntities = unknown> {
  /**
   * Custom strategy for resolving entity references.
   * Default is eager resolution. Can be replaced with lazy/proxy-based approach.
   */
  createUnvisit?: CreateUnvisitFn<TEntities>;
}

// ============================================================================
// Entity Options
// ============================================================================

/**
 * Function to extract an ID from an entity.
 */
export type IdAttributeFn<T = unknown> = (value: T, parent: unknown, key: string | undefined) => IdType;

/**
 * ID attribute can be a string key or a function.
 */
export type IdAttribute<T = unknown> = string | IdAttributeFn<T>;

/**
 * Strategy for merging two entities with the same ID.
 */
export type MergeStrategy<T = unknown> = (entityA: T, entityB: T) => T;

/**
 * Strategy for processing an entity before normalization.
 */
export type ProcessStrategy<T = unknown> = (value: T, parent: unknown, key: string | undefined) => T;

/**
 * Strategy for providing a fallback when an entity is missing during denormalization.
 */
export type FallbackStrategy<T = unknown> = (id: IdType, schema: EntitySchemaInterface) => T | undefined;

/**
 * Options for creating an Entity schema.
 */
export interface EntityOptions<T = unknown> {
  /**
   * The attribute to use as the entity's ID.
   * Can be a string key or a function that extracts the ID.
   * Defaults to 'id'.
   */
  idAttribute?: IdAttribute<T>;

  /**
   * Strategy for merging two entities with the same ID.
   * Defaults to shallow merge with newer entity taking precedence.
   */
  mergeStrategy?: MergeStrategy<T>;

  /**
   * Strategy for processing an entity before normalization.
   * Use this to add extra data, defaults, or transform the entity.
   * Defaults to returning a shallow copy.
   */
  processStrategy?: ProcessStrategy<T>;

  /**
   * Strategy for providing a fallback when an entity is missing during denormalization.
   * Defaults to returning undefined.
   */
  fallbackStrategy?: FallbackStrategy<T>;
}

// ============================================================================
// Normalized Output Types
// ============================================================================

/**
 * The entities store structure - maps entity keys to records of entities by ID.
 */
export type EntitiesMap = Record<string, Record<IdType, unknown>>;

/**
 * The result of normalizing data.
 */
export interface NormalizedSchema<TEntities extends EntitiesMap = EntitiesMap, TResult = unknown> {
  entities: TEntities;
  result: TResult;
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Extract the denormalized (input/nested) type from a schema.
 *
 * This type utility walks a schema tree and produces the TypeScript type
 * that corresponds to the fully-denormalized (nested) data structure.
 *
 * @typeParam S - The schema to extract the denormalized type from
 *
 * @example Entity schema
 * ```typescript
 * interface User { id: string; name: string; }
 * const userSchema = new schema.Entity<'users', User>('users');
 *
 * type DenormalizedUser = Denormalized<typeof userSchema>;
 * // Result: User (the full nested object)
 * ```
 *
 * @example Nested schemas
 * ```typescript
 * const articleSchema = new schema.Entity('articles', { author: userSchema });
 *
 * type DenormalizedArticle = Denormalized<typeof articleSchema>;
 * // Result: { id: string; author: User; ... }
 * ```
 *
 * @example Array shorthand
 * ```typescript
 * type DenormalizedUsers = Denormalized<[typeof userSchema]>;
 * // Result: User[]
 * ```
 */
export type Denormalized<S> =
  S extends SchemaClass<infer TInput, unknown>
    ? TInput
    : S extends readonly [infer Inner]
      ? Array<Denormalized<Inner>>
      : S extends Record<string, unknown>
        ? { [K in keyof S]: Denormalized<S[K]> }
        : S;

/**
 * Extract the normalized (output/flat) type from a schema.
 *
 * This type utility walks a schema tree and produces the TypeScript type
 * that corresponds to the normalized result. For entities, this is the
 * entity's ID; for arrays, it's an array of the inner normalized types.
 *
 * @typeParam S - The schema to extract the normalized type from
 *
 * @example Entity schema
 * ```typescript
 * interface User { id: string; name: string; }
 * const userSchema = new schema.Entity<'users', User>('users');
 *
 * type NormalizedUser = Normalized<typeof userSchema>;
 * // Result: string (the entity ID)
 * ```
 *
 * @example Array shorthand
 * ```typescript
 * type NormalizedUsers = Normalized<[typeof userSchema]>;
 * // Result: string[] (array of entity IDs)
 * ```
 */
export type Normalized<S> =
  S extends SchemaClass<unknown, infer TOutput>
    ? TOutput
    : S extends readonly [infer Inner]
      ? Array<Normalized<Inner>>
      : S extends Record<string, unknown>
        ? { [K in keyof S]: Normalized<S[K]> }
        : S;

/**
 * Interface for entity-like schemas that have a key and data type.
 * Used internally for type inference of the entities store.
 */
export interface EntityLike<TKey extends string = string, TData = unknown> {
  readonly key: TKey;
  readonly _entityType?: TData;
}

/**
 * Internal helper to collect entities from object schema definitions.
 */
type CollectEntitiesFromObject<T extends Record<string, unknown>, Acc extends EntitiesMap> =
  T extends Record<string, infer V> ? EntitiesOf<V, Acc> : Acc;

/**
 * Extract the entities map type from a schema tree.
 *
 * This type utility recursively walks a schema and collects all entity
 * types into a single map structure matching the `entities` output of
 * `normalize()`. Each entity schema contributes its key and data type.
 *
 * @typeParam S - The schema to extract entities from
 * @typeParam Acc - Accumulator for recursive collection (internal use)
 *
 * @example Single entity
 * ```typescript
 * const userSchema = new schema.Entity<'users', User>('users');
 *
 * type Entities = EntitiesOf<typeof userSchema>;
 * // Result: { users: Record<string, User> }
 * ```
 *
 * @example Nested entities
 * ```typescript
 * const articleSchema = new schema.Entity<'articles', Article, { author: typeof userSchema }>('articles', {
 *   author: userSchema
 * });
 *
 * type Entities = EntitiesOf<typeof articleSchema>;
 * // Result: { articles: Record<string, Article>; users: Record<string, User> }
 * ```
 */
export type EntitiesOf<S, Acc extends EntitiesMap = Record<string, never>> =
  S extends EntityLike<infer TKey, infer TData>
    ? Acc & { [K in TKey]: Record<IdType, TData> }
    : S extends SchemaClass
      ? Acc
      : S extends readonly [infer Inner]
        ? EntitiesOf<Inner, Acc>
        : S extends Record<string, unknown>
          ? CollectEntitiesFromObject<S, Acc>
          : Acc;

// ============================================================================
// Utility Types for Schema Construction
// ============================================================================

/**
 * Constructs a denormalized entity type from a schema definition.
 *
 * Use this when you want TypeScript to infer an entity's type from its
 * schema definition, rather than declaring an explicit interface. This is
 * useful for rapid prototyping or when the schema is the source of truth.
 *
 * @typeParam TDefinition - The schema definition mapping nested field names to schemas
 *
 * @example Inferring entity type from schema
 * ```typescript
 * const userSchema = new schema.Entity('users');
 * const articleSchema = new schema.Entity('articles', {
 *   author: userSchema,
 *   reviewers: [userSchema],
 * });
 *
 * // Instead of manually declaring:
 * // interface Article { id: string; author: User; reviewers: User[]; title?: string; }
 *
 * // Let TypeScript infer it:
 * type Article = InferredEntity<typeof articleSchema.schema>;
 * // Result: { id: string; author?: User; reviewers?: User[]; } & Record<string, unknown>
 * ```
 *
 * @remarks
 * - All schema-defined fields are optional (entities may be partially loaded)
 * - Includes `& Record<string, unknown>` for additional untyped fields
 * - For stricter typing, declare an explicit interface instead
 */
export type InferredEntity<TDefinition extends SchemaDefinition = Record<string, never>> = {
  id: IdType;
} & {
  [K in keyof TDefinition]?: Denormalized<TDefinition[K]>;
} & Record<string, unknown>;

/**
 * Constructs a normalized entity type from a schema definition.
 *
 * This represents an entity as stored in the normalized `entities` map,
 * where nested schemas have been replaced with their IDs (or normalized forms).
 *
 * @typeParam TDefinition - The schema definition mapping nested field names to schemas
 *
 * @example Understanding normalized vs denormalized
 * ```typescript
 * const userSchema = new schema.Entity('users');
 * const articleSchema = new schema.Entity('articles', { author: userSchema });
 *
 * // Denormalized (nested):
 * // { id: '1', title: 'Hello', author: { id: '42', name: 'Alice' } }
 *
 * // Normalized (flat) - what's stored in entities.articles:
 * // { id: '1', title: 'Hello', author: '42' }  // author is now just an ID
 *
 * type NormalizedArticle = NormalizedEntity<typeof articleSchema.schema>;
 * // Result: { id: string; author?: string; } & Record<string, unknown>
 * ```
 *
 * @remarks
 * - Use this to type the values in your entities store
 * - Nested entity references become their ID types (typically `string`)
 * - Nested arrays become arrays of IDs
 */
export type NormalizedEntity<TDefinition extends SchemaDefinition = Record<string, never>> = {
  id: IdType;
} & {
  [K in keyof TDefinition]?: Normalized<TDefinition[K]>;
} & Record<string, unknown>;
