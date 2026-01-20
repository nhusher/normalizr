/**
 * Type tests for normalizr utility types.
 *
 * These tests verify that TypeScript type inference works correctly.
 * They use compile-time assertions - if this file compiles, the types are correct.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  schema,
  normalize,
  denormalize,
  Denormalized,
  Normalized,
  AllEntitiesOf,
  NormalizedEntity,
  IdType,
  UnionToIntersection,
  SchemaFunction,
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

// Use the .as<T>() pattern instead of explicit type parameters like
// `new schema.Entity<'users', User>('users')` because explicit type params
// cause TypeScript to use defaults for unspecified params (TDefinition = {}),
// which breaks nested entity type inference.

const typedUserSchema = new schema.Entity('users').as<User>();
const typedCommentSchema = new schema.Entity('comments', {
  author: typedUserSchema,
}).as<Comment>();
const typedArticleSchema = new schema.Entity('articles', {
  author: typedUserSchema,
  comments: [typedCommentSchema],
}).as<Article>();

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
// AllEntitiesOf<S> Tests
// =============================================================================

describe('AllEntitiesOf<S>', () => {
  it('collects entity from a single entity schema', () => {
    type Result = AllEntitiesOf<typeof typedUserSchema>;
    expectTypeOf<Result>().toEqualTypeOf<{ users: Record<IdType, User> }>();
  });

  it('recursively collects all entities from nested schemas', () => {
    // typedArticleSchema has author (User) and comments (Comment[])
    // commentSchema has author (User)
    type Result = AllEntitiesOf<typeof typedArticleSchema>;

    // Should collect articles, users, and comments
    expectTypeOf<Result>().toHaveProperty('articles');
    expectTypeOf<Result>().toHaveProperty('users');
    expectTypeOf<Result>().toHaveProperty('comments');
  });

  it('collects entities from array shorthand', () => {
    type Result = AllEntitiesOf<[typeof typedArticleSchema]>;

    expectTypeOf<Result>().toHaveProperty('articles');
    expectTypeOf<Result>().toHaveProperty('users');
    expectTypeOf<Result>().toHaveProperty('comments');
  });

  it('collects entities from object shorthand', () => {
    type Result = AllEntitiesOf<{ article: typeof typedArticleSchema }>;

    expectTypeOf<Result>().toHaveProperty('articles');
    expectTypeOf<Result>().toHaveProperty('users');
    expectTypeOf<Result>().toHaveProperty('comments');
  });

  it('works with .as<T>() narrowed schemas', () => {
    const articleSchema = new schema.Entity('articles', {
      author: typedUserSchema,
    }).as<Article>();

    type Result = AllEntitiesOf<typeof articleSchema>;

    expectTypeOf<Result>().toHaveProperty('articles');
    expectTypeOf<Result>().toHaveProperty('users');
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
// EntitySchema.as<T>() Tests
// =============================================================================

describe('EntitySchema.as<T>()', () => {
  it('narrows TData while preserving TKey and TDefinition', () => {
    const articleSchema = new schema.Entity('articles', {
      author: typedUserSchema,
      comments: [typedCommentSchema],
    }).as<Article>();

    // TData should be Article
    type DataType = Denormalized<typeof articleSchema>;
    expectTypeOf<DataType>().toEqualTypeOf<Article>();

    // TKey should still be 'articles'
    expectTypeOf(articleSchema.key).toEqualTypeOf<'articles'>();

    // TDefinition should be preserved - schema should have author and comments
    type SchemaType = typeof articleSchema.schema;
    expectTypeOf<SchemaType>().toHaveProperty('author');
    expectTypeOf<SchemaType>().toHaveProperty('comments');
  });

  it('works with NormalizedEntity after .as<T>()', () => {
    const articleSchema = new schema.Entity('articles', {
      author: typedUserSchema,
      comments: [typedCommentSchema],
    }).as<Article>();

    type Result = NormalizedEntity<typeof articleSchema.schema>;
    expectTypeOf<Result>().toEqualTypeOf<{ id: IdType; author?: IdType; comments?: IdType[] }>();
  });

  it('allows chaining .as<T>() immediately after constructor', () => {
    const simpleSchema = new schema.Entity('items').as<{ id: string; name: string }>();

    type DataType = Denormalized<typeof simpleSchema>;
    expectTypeOf<DataType>().toEqualTypeOf<{ id: string; name: string }>();
  });

  it('returns the same instance at runtime', () => {
    const original = new schema.Entity('test');
    const narrowed = original.as<{ id: string }>();

    // Same instance (this is a runtime check, not a type check)
    expect(original).toBe(narrowed);
  });
});

// =============================================================================
// Integration Tests: normalize() return type
// =============================================================================

describe('normalize() return type', () => {
  it('returns correctly typed result for entity schema', () => {
    const data: User = { id: '1', name: 'Alice', email: 'alice@example.com' };
    const result = normalize(data, typedUserSchema);

    // result should be the normalized type (IdType for entities)
    expectTypeOf(result.result).toEqualTypeOf<IdType>();

    // entities should have the correct structure
    expectTypeOf(result.entities).toHaveProperty('users');
  });

  it('returns correctly typed result for array shorthand', () => {
    const data: User[] = [{ id: '1', name: 'Alice', email: 'alice@example.com' }];
    const result = normalize(data, [typedUserSchema]);

    // result should be an array of IDs
    expectTypeOf(result.result).toEqualTypeOf<IdType[]>();

    // entities should have the correct structure
    expectTypeOf(result.entities).toHaveProperty('users');
  });

  it('returns correctly typed entities for nested schemas', () => {
    const data: Article = {
      id: '1',
      title: 'Test',
      author: { id: '1', name: 'Alice', email: 'alice@example.com' },
      comments: [],
    };
    const result = normalize(data, typedArticleSchema);

    // result should be IdType
    expectTypeOf(result.result).toEqualTypeOf<IdType>();

    // entities should have all nested entity types
    expectTypeOf(result.entities).toHaveProperty('articles');
    expectTypeOf(result.entities).toHaveProperty('users');
    expectTypeOf(result.entities).toHaveProperty('comments');
  });
});

// =============================================================================
// Integration Tests: denormalize() return type
// =============================================================================

describe('denormalize() return type', () => {
  it('returns the denormalized type or undefined', () => {
    const entities = {
      users: { '1': { id: '1', name: 'Alice', email: 'alice@example.com' } },
    };
    const result = denormalize('1', typedUserSchema, entities);

    // denormalize returns Denormalized<S> | undefined
    expectTypeOf(result).toEqualTypeOf<User | undefined>();
  });

  it('returns correctly typed result for nested schemas', () => {
    const entities = {
      articles: { '1': { id: '1', title: 'Test', author: '1', comments: [] } },
      users: { '1': { id: '1', name: 'Alice', email: 'alice@example.com' } },
      comments: {},
    };
    const result = denormalize('1', typedArticleSchema, entities);

    // denormalize returns Denormalized<S> | undefined
    expectTypeOf(result).toEqualTypeOf<Article | undefined>();
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
    type UserEntities = AllEntitiesOf<typeof userSchema>;

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

// =============================================================================
// UnionToIntersection Black Magic Test
// =============================================================================

describe('UnionToIntersection', () => {
  it('converts a union of objects to an intersection', () => {
    type Union = { a: 1 } | { b: 2 } | { c: 3 };
    type Result = UnionToIntersection<Union>;

    // The union becomes an intersection!
    expectTypeOf<Result>().toEqualTypeOf<{ a: 1 } & { b: 2 } & { c: 3 }>();
  });

  it('works with more complex types', () => {
    type Union = { users: Record<string, string> } | { articles: Record<string, number> };
    type Result = UnionToIntersection<Union>;

    expectTypeOf<Result>().toEqualTypeOf<{ users: Record<string, string> } & { articles: Record<string, number> }>();
  });

  it('collapses identical types in the union', () => {
    type Union = { a: 1 } | { a: 1 } | { a: 1 };
    type Result = UnionToIntersection<Union>;

    // Three identical types intersected = same type
    expectTypeOf<Result>().toEqualTypeOf<{ a: 1 }>();
  });

  it('produces never for incompatible primitive unions', () => {
    type Union = string | number;
    type Result = UnionToIntersection<Union>;

    // string & number = never (no value can be both)
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });
});

// =============================================================================
// SchemaFunction Type Inference Tests
// =============================================================================

describe('SchemaFunction type inference', () => {
  // Additional test types for dynamic schemas
  interface Media {
    id: string;
    url: string;
  }

  interface Post {
    id: string;
    title: string;
  }

  interface FeedItem {
    id: string;
    contentType: 'media' | 'post';
    content: Media | Post;
  }

  const mediaSchema = new schema.Entity('media').as<Media>();
  const postSchema = new schema.Entity('posts').as<Post>();

  it('extracts entities from a schema function with inferred single return type', () => {
    // Function with inferred return type (single schema)
    const dynamicSchema = (_parent: unknown) => mediaSchema;

    type Result = AllEntitiesOf<typeof dynamicSchema>;
    expectTypeOf<Result>().toEqualTypeOf<{ media: Record<IdType, Media> }>();
  });

  it('extracts entities from a schema function with inferred union return type', () => {
    // Function with inferred return type (union of schemas)
    // Note: parameter must be `unknown` to be compatible with SchemaFunction
    const dynamicSchema = (parent: unknown) => {
      const p = parent as { type: string };
      return p.type === 'media' ? mediaSchema : postSchema;
    };

    type Result = AllEntitiesOf<typeof dynamicSchema>;

    // Should have both media and posts
    expectTypeOf<Result>().toHaveProperty('media');
    expectTypeOf<Result>().toHaveProperty('posts');
  });

  it('extracts entities from entity definition containing a schema function', () => {
    // Entity with a dynamic schema in its definition
    // Note: function parameter must be `unknown` to match SchemaFunction type
    const feedItemSchema = new schema.Entity('feedItems', {
      content: (parent: unknown) => {
        const p = parent as { contentType: string };
        return p.contentType === 'media' ? mediaSchema : postSchema;
      },
    }).as<FeedItem>();

    type Result = AllEntitiesOf<typeof feedItemSchema>;

    // Should have feedItems, media, and posts
    expectTypeOf<Result>().toHaveProperty('feedItems');
    expectTypeOf<Result>().toHaveProperty('media');
    expectTypeOf<Result>().toHaveProperty('posts');
  });

  it('extracts entities when function has explicit annotation with specific return type', () => {
    // Explicit return type annotation that is specific (not just Schema)
    const dynamicSchema = (_parent: unknown): typeof mediaSchema | typeof postSchema => mediaSchema;

    type Result = AllEntitiesOf<typeof dynamicSchema>;

    expectTypeOf<Result>().toHaveProperty('media');
    expectTypeOf<Result>().toHaveProperty('posts');
  });

  it('does NOT extract entities when explicitly typed as SchemaFunction (known limitation)', () => {
    // When explicitly typed as SchemaFunction, return type is Schema (too broad)
    const dynamicSchema: SchemaFunction = (_parent: unknown) => mediaSchema;

    type Result = AllEntitiesOf<typeof dynamicSchema>;

    // This is a known limitation: SchemaFunction has return type Schema,
    // which is too broad for type inference. Result is empty.
    expectTypeOf<Result>().toEqualTypeOf<{}>();
  });
});
