/**
 * Type tests for normalizr utility types.
 *
 * These tests verify that TypeScript type inference works correctly.
 * They use compile-time assertions - if this file compiles, the types are correct.
 */

import { describe, it, expectTypeOf } from 'vitest';
import {
  schema,
  normalize,
  denormalize,
  Denormalized,
  Normalized,
  EntitiesOf,
  InferredEntity,
  NormalizedEntity,
  IdType,
} from '../src/index.js';

// =============================================================================
// Test Data Types
// =============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  body: string;
  author: User;
}

interface Article {
  id: string;
  title: string;
  author: User;
  comments: Comment[];
}

// =============================================================================
// Schema Definitions
// =============================================================================

const typedUserSchema = new schema.Entity<'users', User>('users');
const typedCommentSchema = new schema.Entity<'comments', Comment>('comments', {
  author: typedUserSchema,
});
const typedArticleSchema = new schema.Entity<'articles', Article>('articles', {
  author: typedUserSchema,
  comments: [typedCommentSchema],
});

// =============================================================================
// Denormalized<S> Tests
// =============================================================================

describe('Denormalized<S>', () => {
  it('extracts the denormalized type from a typed entity schema', () => {
    type Result = Denormalized<typeof typedUserSchema>;
    expectTypeOf<Result>().toEqualTypeOf<User>();
  });

  it('extracts the denormalized type from a nested entity schema', () => {
    type Result = Denormalized<typeof typedArticleSchema>;
    expectTypeOf<Result>().toEqualTypeOf<Article>();
  });

  it('handles array shorthand schemas', () => {
    type Result = Denormalized<[typeof typedUserSchema]>;
    expectTypeOf<Result>().toEqualTypeOf<User[]>();
  });

  it('handles object shorthand schemas', () => {
    type Result = Denormalized<{ user: typeof typedUserSchema }>;
    expectTypeOf<Result>().toEqualTypeOf<{ user: User }>();
  });

  it('handles nested object shorthand schemas', () => {
    type Result = Denormalized<{
      users: [typeof typedUserSchema];
      featured: typeof typedArticleSchema;
    }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      users: User[];
      featured: Article;
    }>();
  });
});

// =============================================================================
// Normalized<S> Tests
// =============================================================================

describe('Normalized<S>', () => {
  it('extracts the normalized type (ID) from an entity schema', () => {
    type Result = Normalized<typeof typedUserSchema>;
    expectTypeOf<Result>().toEqualTypeOf<IdType>();
  });

  it('handles array shorthand schemas', () => {
    type Result = Normalized<[typeof typedUserSchema]>;
    expectTypeOf<Result>().toEqualTypeOf<IdType[]>();
  });

  it('handles object shorthand schemas', () => {
    type Result = Normalized<{ user: typeof typedUserSchema }>;
    expectTypeOf<Result>().toEqualTypeOf<{ user: IdType }>();
  });

  it('handles nested object shorthand schemas', () => {
    type Result = Normalized<{
      users: [typeof typedUserSchema];
      featured: typeof typedArticleSchema;
    }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      users: IdType[];
      featured: IdType;
    }>();
  });
});

// =============================================================================
// EntitiesOf<S> Tests
// =============================================================================

describe('EntitiesOf<S>', () => {
  it('extracts entities map for a single entity schema', () => {
    type Result = EntitiesOf<typeof typedUserSchema>;
    expectTypeOf<Result>().toEqualTypeOf<{ users: Record<IdType, User> }>();
  });

  it('extracts entities map from array shorthand', () => {
    type Result = EntitiesOf<[typeof typedUserSchema]>;
    expectTypeOf<Result>().toEqualTypeOf<{ users: Record<IdType, User> }>();
  });

  it('extracts entities map from object shorthand', () => {
    type Result = EntitiesOf<{ user: typeof typedUserSchema }>;
    expectTypeOf<Result>().toEqualTypeOf<{ users: Record<IdType, User> }>();
  });

  it('supports composition via intersection for multiple schemas', () => {
    // For a complete entities map, compose with intersection
    type AllEntities = EntitiesOf<typeof typedUserSchema> &
      EntitiesOf<typeof typedCommentSchema> &
      EntitiesOf<typeof typedArticleSchema>;

    expectTypeOf<AllEntities>().toEqualTypeOf<
      { users: Record<IdType, User> } & { comments: Record<IdType, Comment> } & { articles: Record<IdType, Article> }
    >();
  });
});

// =============================================================================
// InferredEntity<TDefinition> Tests
// =============================================================================

describe('InferredEntity<TDefinition>', () => {
  it('infers entity type with id field', () => {
    type Result = InferredEntity<{}>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType }>();
  });

  it('infers entity type from schema definition', () => {
    const articleSchema = new schema.Entity('articles', {
      author: typedUserSchema,
    });

    type Result = InferredEntity<typeof articleSchema.schema>;
    // Schema-defined fields are optional
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType; author?: User }>();
  });

  it('handles array definitions', () => {
    const articleSchema = new schema.Entity('articles', {
      comments: [typedCommentSchema],
    });

    type Result = InferredEntity<typeof articleSchema.schema>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType; comments?: Comment[] }>();
  });
});

// =============================================================================
// NormalizedEntity<TDefinition> Tests
// =============================================================================

describe('NormalizedEntity<TDefinition>', () => {
  it('produces normalized entity type with id field', () => {
    type Result = NormalizedEntity<{}>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType }>();
  });

  it('converts nested entity references to IDs', () => {
    const articleSchema = new schema.Entity('articles', {
      author: typedUserSchema,
    });

    type Result = NormalizedEntity<typeof articleSchema.schema>;
    // Nested entities become their ID type (string)
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType; author?: IdType }>();
  });

  it('converts nested entity arrays to ID arrays', () => {
    const articleSchema = new schema.Entity('articles', {
      comments: [typedCommentSchema],
    });

    type Result = NormalizedEntity<typeof articleSchema.schema>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType; comments?: IdType[] }>();
  });
});

// =============================================================================
// Integration Tests: normalize() return type
// =============================================================================

describe('normalize() return type', () => {
  it('returns correctly typed result for entity schema', () => {
    const data: User = { id: '1', name: 'Alice', email: 'alice@example.com' };
    const result = normalize(data, typedUserSchema);

    // normalize() returns unknown for result type - consumer should use Normalized<S> for type safety
    expectTypeOf(result.result).toBeUnknown();
    expectTypeOf(result.entities).toEqualTypeOf<Record<string, Record<string, unknown>>>();
  });

  it('returns correctly typed result for array shorthand', () => {
    const data: User[] = [{ id: '1', name: 'Alice', email: 'alice@example.com' }];
    const result = normalize(data, [typedUserSchema]);

    expectTypeOf(result.result).toBeUnknown();
    expectTypeOf(result.entities).toEqualTypeOf<Record<string, Record<string, unknown>>>();
  });
});

// =============================================================================
// Integration Tests: denormalize() return type
// =============================================================================

describe('denormalize() return type', () => {
  it('returns unknown (consumer must assert type)', () => {
    const entities = {
      users: { '1': { id: '1', name: 'Alice', email: 'alice@example.com' } },
    };
    const result = denormalize('1', typedUserSchema, entities);

    // denormalize returns unknown - consumer must assert the type
    expectTypeOf(result).toBeUnknown();
  });
});

// =============================================================================
// Practical Usage Patterns
// =============================================================================

describe('practical usage patterns', () => {
  it('supports explicit type parameters on Entity', () => {
    // This is the recommended pattern for type-safe schemas
    const userSchema = new schema.Entity<'users', User>('users');

    type DenormalizedUser = Denormalized<typeof userSchema>;
    type NormalizedUser = Normalized<typeof userSchema>;
    type UserEntities = EntitiesOf<typeof userSchema>;

    expectTypeOf<DenormalizedUser>().toEqualTypeOf<User>();
    expectTypeOf<NormalizedUser>().toEqualTypeOf<IdType>();
    expectTypeOf<UserEntities>().toEqualTypeOf<{ users: Record<IdType, User> }>();
  });

  it('supports nested schemas with full type inference', () => {
    interface Author {
      id: string;
      name: string;
    }

    interface Book {
      id: string;
      title: string;
      author: Author;
    }

    const authorSchema = new schema.Entity<'authors', Author>('authors');
    const bookSchema = new schema.Entity<'books', Book>('books', {
      author: authorSchema,
    });

    type DenormalizedBook = Denormalized<typeof bookSchema>;
    type NormalizedBook = Normalized<typeof bookSchema>;

    expectTypeOf<DenormalizedBook>().toEqualTypeOf<Book>();
    expectTypeOf<NormalizedBook>().toEqualTypeOf<IdType>();
  });

  it('supports circular reference schemas (define method)', () => {
    interface Person {
      id: string;
      name: string;
      friends: Person[];
    }

    // For circular references, we need explicit type parameters
    const personSchema = new schema.Entity<'people', Person>('people');
    personSchema.define({ friends: [personSchema] });

    type DenormalizedPerson = Denormalized<typeof personSchema>;
    expectTypeOf<DenormalizedPerson>().toEqualTypeOf<Person>();
  });
});
