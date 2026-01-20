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
 * However, we accept both string and number for convenience.
 */
export type IdType = string | number;

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
 * Recursively collects all entity types from a schema tree.
 *
 * This type walks the schema and collects all entity types into a map
 * structure matching the `entities` output of `normalize()`.
 *
 * @typeParam S - The schema to extract all entities from
 *
 * @example Single entity
 * ```typescript
 * const userSchema = new schema.Entity<'users', User>('users');
 *
 * type Entities = AllEntitiesOf<typeof userSchema>;
 * // Result: { users: Record<string, User> }
 * ```
 *
 * @example Nested schema (collects all entities recursively)
 * ```typescript
 * const articleSchema = new schema.Entity('articles', {
 *   author: userSchema,
 *   comments: [commentSchema],
 * }).as<Article>();
 *
 * type Entities = AllEntitiesOf<typeof articleSchema>;
 * // Result: {
 * //   articles: Record<string, Article>;
 * //   users: Record<string, User>;
 * //   comments: Record<string, Comment>;
 * // }
 * ```
 *
 * @example Array and object shorthands
 * ```typescript
 * type FromArray = AllEntitiesOf<[typeof articleSchema]>;
 * // Result: { articles: ..., users: ..., comments: ... }
 *
 * type FromObject = AllEntitiesOf<{ article: typeof articleSchema }>;
 * // Result: { articles: ..., users: ..., comments: ... }
 * ```
 */
export type AllEntitiesOf<S, Seen = never> = Expand<AllEntitiesOfInternal<S, Seen>>;

/**
 * Internal recursive implementation of AllEntitiesOf.
 * @internal
 */
type AllEntitiesOfInternal<S, Seen = never> =
  // Prevent infinite recursion for circular schemas
  S extends Seen
    ? {}
    : S extends EntityLike<infer TKey, infer TData>
      ? { [K in TKey]: Record<IdType, TData> } & AllEntitiesOfInternal<GetSchemaDefinition<S>, Seen | S>
      : S extends readonly [infer Inner]
        ? AllEntitiesOfInternal<Inner, Seen>
        : S extends SchemaClass
          ? {} // Non-entity schema classes don't contribute entities
          : // Handle schema functions by extracting their return type.
            // This works when the function has a specific inferred return type,
            // but not when explicitly typed as SchemaFunction (return type: Schema).
            // We use UnionToIntersection because when the return type is a union
            // (e.g., schemaA | schemaB), we want to collect entities from ALL branches.
            // We bail out if the return type includes SchemaFunction (indicating it's
            // the broad Schema type, which would cause infinite recursion).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            S extends (arg: any) => infer R
            ? SchemaFunction extends R
              ? {} // Return type is too broad (includes SchemaFunction), bail out
              : UnionToIntersection<AllEntitiesOfInternal<R, Seen | S>>
            : S extends Record<string, unknown>
              ? // Guard against index signature types (like { [key: string]: Schema }) which cause deep recursion
                string extends keyof S
                ? {}
                : UnionToIntersection<{ [K in keyof S]: AllEntitiesOfInternal<S[K], Seen> }[keyof S]>
              : {};

/**
 * Helper to extract schema definition from an entity schema.
 * @internal
 */
type GetSchemaDefinition<S> = S extends { schema: infer D } ? D : {};

/**
 * Converts a union type to an intersection type.
 * @internal
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

// ============================================================================
// Internal Type Utilities
// ============================================================================

/**
 * Flattens intersection types into a single object type.
 *
 * This utility forces TypeScript to eagerly evaluate intersection types
 * (like `{ a: string } & { b: number }`) into a single object type
 * (`{ a: string; b: number }`). This improves IDE display and ensures
 * consistent behavior across different TypeScript language server
 * implementations.
 *
 * @internal
 */
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// ============================================================================
// Utility Types for Schema Construction
// ============================================================================

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
 * // Result: { id: string; author?: string; }
 * ```
 *
 * @remarks
 * - Use this to type the values in your entities store
 * - Nested entity references become their ID types (typically `string`)
 * - Nested arrays become arrays of IDs
 * - Only includes fields from the schema definition; for additional fields, declare an explicit interface
 */
export type NormalizedEntity<TDefinition extends SchemaDefinition = Record<string, never>> = Expand<
  {
    id: IdType;
  } & {
    [K in keyof TDefinition]?: Normalized<TDefinition[K]>;
  }
>;
