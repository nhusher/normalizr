/**
 * Documentation Examples Test Suite
 *
 * This file contains tests for all code examples in the documentation.
 * It should be kept in sync with the examples in:
 * - README.md
 * - docs/api.md
 * - docs/faqs.md
 *
 * Each test is named to match its corresponding documentation section
 * for easy cross-referencing.
 */

import { describe, test, expect, expectTypeOf } from 'vitest';
import {
  normalize,
  denormalize,
  schema,
  Denormalized,
  AllEntitiesOf,
  Normalized,
  NormalizedEntity,
} from '../src/index.js';

describe('api.md examples', () => {
  describe('normalize(data, schema)', () => {
    test('api.md#normalize-usage - basic normalize example', () => {
      const myData = { users: [{ id: 1 }, { id: 2 }] };
      const user = new schema.Entity('users');
      const normalizedData = normalize(myData, { users: [user] });

      // Note: result array contains the original ID values (numbers),
      // while entity keys are always strings
      expect(normalizedData).toEqual({
        result: { users: [1, 2] },
        entities: {
          users: {
            '1': { id: 1 },
            '2': { id: 2 },
          },
        },
      });
    });
  });

  describe('denormalize(input, schema, entities)', () => {
    test('api.md#denormalize-usage - basic denormalize example', () => {
      const user = new schema.Entity('users');
      const entities = { users: { '1': { id: 1 }, '2': { id: 2 } } };
      const denormalizedData = denormalize({ users: [1, 2] }, { users: [user] }, entities);

      expect(denormalizedData).toEqual({
        users: [{ id: 1 }, { id: 2 }],
      });
    });

    describe('schema.Array', () => {
      test('api.md#array-usage - simple array of entities', () => {
        const data = [
          { id: '123', name: 'Jim' },
          { id: '456', name: 'Jane' },
        ];
        const userSchema = new schema.Entity('users');

        const userListSchema = new schema.Array(userSchema);
        const normalizedData = normalize(data, userListSchema);

        expect(normalizedData).toEqual({
          entities: {
            users: {
              '123': { id: '123', name: 'Jim' },
              '456': { id: '456', name: 'Jane' },
            },
          },
          result: ['123', '456'],
        });
      });

      test('api.md#array-usage-shorthand - shorthand array syntax', () => {
        const data = [
          { id: '123', name: 'Jim' },
          { id: '456', name: 'Jane' },
        ];
        const userSchema = new schema.Entity('users');

        // Shorthand syntax
        const userListSchema = new schema.Array(userSchema);
        const normalizedData = normalize(data, userListSchema);

        expect(normalizedData).toEqual({
          entities: {
            users: {
              '123': { id: '123', name: 'Jim' },
              '456': { id: '456', name: 'Jane' },
            },
          },
          result: ['123', '456'],
        });
      });

      test('api.md#array-polymorphic - polymorphic array with schema mapping', () => {
        const data = [
          { id: 1, type: 'admin' },
          { id: 2, type: 'user' },
        ];

        const userSchema = new schema.Entity('users');
        const adminSchema = new schema.Entity('admins');
        const myArray = new schema.Array(
          {
            admins: adminSchema,
            users: userSchema,
          },
          (input) => `${(input as { type: string }).type}s`,
        );

        const normalizedData = normalize(data, myArray);

        expect(normalizedData).toEqual({
          entities: {
            admins: { '1': { id: 1, type: 'admin' } },
            users: { '2': { id: 2, type: 'user' } },
          },
          result: [
            { id: 1, schema: 'admins' },
            { id: 2, schema: 'users' },
          ],
        });
      });
    });

    describe('schema.Entity', () => {
      test('api.md#entity-usage - entity with options', () => {
        const data = {
          id_str: '123',
          url: 'https://twitter.com',
          user: { id_str: '456', name: 'Jimmy' },
        };

        const user = new schema.Entity('users', {}, { idAttribute: 'id_str' });
        const tweet = new schema.Entity(
          'tweets',
          { user: user },
          {
            idAttribute: 'id_str',
            // Apply everything from entityB over entityA, except for "favorites"
            mergeStrategy: (entityA, entityB) => ({
              ...entityA,
              ...entityB,
              favorites: entityA.favorites,
            }),
            // Remove the URL field from the entity
            processStrategy: (entity) => {
              const { url, ...rest } = entity;
              return rest;
            },
          },
        );

        const normalizedData = normalize(data, tweet);

        expect(normalizedData).toEqual({
          entities: {
            tweets: { '123': { id_str: '123', user: '456' } },
            users: { '456': { id_str: '456', name: 'Jimmy' } },
          },
          result: '123',
        });
      });

      test('api.md#idattribute-function - idAttribute as function', () => {
        const data = [
          { id: '1', guest_id: null, name: 'Esther' },
          { id: '1', guest_id: '22', name: 'Tom' },
        ];

        const patronsSchema = new schema.Entity('patrons', undefined, {
          // idAttribute *functions* must return the ids **value** (not key)
          idAttribute: (value: { id: string; guest_id: string | null }) =>
            value.guest_id ? `${value.id}-${value.guest_id}` : value.id,
        });

        const normalizedData = normalize(data, [patronsSchema]);

        expect(normalizedData).toEqual({
          entities: {
            patrons: {
              '1': { id: '1', guest_id: null, name: 'Esther' },
              '1-22': { id: '1', guest_id: '22', name: 'Tom' },
            },
          },
          result: ['1', '1-22'],
        });
      });

      test('api.md#fallbackstrategy-usage - fallbackStrategy for missing entities', () => {
        const users = {
          '1': { id: '1', name: 'Emily', requestState: 'SUCCEEDED' },
          '2': { id: '2', name: 'Douglas', requestState: 'SUCCEEDED' },
        };
        const books = {
          '1': { id: '1', name: 'Book 1', author: 1 },
          '2': { id: '2', name: 'Book 2', author: 2 },
          '3': { id: '3', name: 'Book 3', author: 3 },
        };

        const authorSchema = new schema.Entity(
          'authors',
          {},
          {
            fallbackStrategy: (key, schema) => {
              return {
                [schema.idAttribute as string]: key,
                name: 'Unknown',
                requestState: 'NONE',
              };
            },
          },
        );
        const bookSchema = new schema.Entity('books', {
          author: authorSchema,
        });

        const result = denormalize([1, 2, 3], [bookSchema], {
          books,
          authors: users,
        });

        // Note: fallbackStrategy receives the original key type (number 3),
        // which is used in the fallback entity
        expect(result).toEqual([
          {
            id: '1',
            name: 'Book 1',
            author: { id: '1', name: 'Emily', requestState: 'SUCCEEDED' },
          },
          {
            id: '2',
            name: 'Book 2',
            author: { id: '2', name: 'Douglas', requestState: 'SUCCEEDED' },
          },
          {
            id: '3',
            name: 'Book 3',
            author: { id: 3, name: 'Unknown', requestState: 'NONE' },
          },
        ]);
      });

      test('api.md#dynamic-schema-functions - dynamic schema based on parent', () => {
        const mediaSchema = new schema.Entity('media');
        const articleSchema = new schema.Entity('articles');

        const feedItemSchema = new schema.Entity('feedItems', {
          // Choose schema based on the parent's 'contentType' field
          content: (parent: unknown) => {
            const p = parent as { contentType: string };
            switch (p.contentType) {
              case 'media':
                return mediaSchema;
              case 'article':
              default:
                return articleSchema;
            }
          },
        });

        const data = [
          { id: '1', contentType: 'media', content: { id: 'm1', url: 'photo.jpg' } },
          { id: '2', contentType: 'article', content: { id: 'a1', title: 'Hello World' } },
        ];

        const normalizedData = normalize(data, [feedItemSchema]);

        expect(normalizedData).toEqual({
          entities: {
            feedItems: {
              '1': { id: '1', contentType: 'media', content: 'm1' },
              '2': { id: '2', contentType: 'article', content: 'a1' },
            },
            media: {
              'm1': { id: 'm1', url: 'photo.jpg' },
            },
            articles: {
              'a1': { id: 'a1', title: 'Hello World' },
            },
          },
          result: ['1', '2'],
        });
      });
    });

    describe('schema.Object', () => {
      test('api.md#object-usage - object schema', () => {
        // Example data response
        const data = { users: [{ id: '123', name: 'Beth' }] };

        const user = new schema.Entity('users');
        const responseSchema = new schema.Object({ users: new schema.Array(user) });

        const normalizedData = normalize(data, responseSchema);

        expect(normalizedData).toEqual({
          entities: {
            users: { '123': { id: '123', name: 'Beth' } },
          },
          result: { users: ['123'] },
        });
      });

      test('api.md#object-usage-shorthand - shorthand object syntax', () => {
        const data = { users: [{ id: '123', name: 'Beth' }] };

        const user = new schema.Entity('users');
        // Shorthand
        const responseSchema = { users: new schema.Array(user) };

        const normalizedData = normalize(data, responseSchema);

        expect(normalizedData).toEqual({
          entities: {
            users: { '123': { id: '123', name: 'Beth' } },
          },
          result: { users: ['123'] },
        });
      });
    });

    describe('schema.Union', () => {
      test('api.md#union-usage - union schema', () => {
        const data = { owner: { id: 1, type: 'user', name: 'Anne' } };

        const user = new schema.Entity('users');
        const group = new schema.Entity('groups');
        const unionSchema = new schema.Union(
          {
            user: user,
            group: group,
          },
          'type',
        );

        const normalizedData = normalize(data, { owner: unionSchema });

        expect(normalizedData).toEqual({
          entities: {
            users: { '1': { id: 1, type: 'user', name: 'Anne' } },
          },
          result: { owner: { id: 1, schema: 'user' } },
        });
      });
    });

    describe('schema.Values', () => {
      test('api.md#values-usage - simple values schema', () => {
        const data = { firstThing: { id: 1 }, secondThing: { id: 2 } };

        const item = new schema.Entity('items');
        const valuesSchema = new schema.Values(item);

        const normalizedData = normalize(data, valuesSchema);

        // Note: result values contain the original ID type (numbers)
        expect(normalizedData).toEqual({
          entities: {
            items: { '1': { id: 1 }, '2': { id: 2 } },
          },
          result: { firstThing: 1, secondThing: 2 },
        });
      });

      test('api.md#values-polymorphic - polymorphic values schema', () => {
        const data = {
          '1': { id: 1, type: 'admin' },
          '2': { id: 2, type: 'user' },
        };

        const userSchema = new schema.Entity('users');
        const adminSchema = new schema.Entity('admins');
        const valuesSchema = new schema.Values(
          {
            admins: adminSchema,
            users: userSchema,
          },
          (input) => `${(input as { type: string }).type}s`,
        );

        const normalizedData = normalize(data, valuesSchema);

        expect(normalizedData).toEqual({
          entities: {
            admins: { '1': { id: 1, type: 'admin' } },
            users: { '2': { id: 2, type: 'user' } },
          },
          result: {
            '1': { id: 1, schema: 'admins' },
            '2': { id: 2, schema: 'users' },
          },
        });
      });
    });
  });

  describe('Type Utilities', () => {
    test('api.md#as-method - .as<T>() method usage', () => {
      // Define your data types
      interface User {
        id: string;
        name: string;
      }

      interface Article {
        id: string;
        title: string;
        author: User;
      }

      // Create schemas with .as<T>() - the recommended pattern
      const userSchema = new schema.Entity('users').as<User>();
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
      }).as<Article>();

      // Type utilities work with full nested type information
      expectTypeOf<Denormalized<typeof articleSchema>>().toEqualTypeOf<Article>();
      expectTypeOf<AllEntitiesOf<typeof articleSchema>>().toMatchTypeOf<{
        users: Record<string, User>;
        articles: Record<string, Article>;
      }>();

      // Runtime test
      const data: Article = {
        id: '1',
        title: 'Test Article',
        author: { id: '2', name: 'John' },
      };

      const normalized = normalize(data, articleSchema);

      expect(normalized.entities.users).toBeDefined();
      expect(normalized.entities.articles).toBeDefined();
      expect(normalized.entities.users?.['2']).toEqual({ id: '2', name: 'John' });
    });

    test('api.md#denormalized-type - Denormalized<S> type utility', () => {
      // Without explicit types (inferred as generic)
      const userSchema = new schema.Entity('users');
      const articleSchema = new schema.Entity('articles', { author: userSchema });

      // Denormalized extracts the nested type from a schema
      // Without .as<T>(), the type is Record<string, unknown>
      type ArticleType = Denormalized<typeof articleSchema>;
      const _typeCheck: ArticleType = { id: '1', author: {} };
      expect(_typeCheck).toBeDefined();

      // With .as<T>() (fully typed)
      interface User {
        id: string;
        name: string;
      }

      const typedUserSchema = new schema.Entity('users').as<User>();

      expectTypeOf<Denormalized<typeof typedUserSchema>>().toEqualTypeOf<User>();

      // Runtime test to verify schemas work
      const data = { id: '1', title: 'Test', author: { id: '2', name: 'Jane' } };
      const normalized = normalize(data, articleSchema);
      expect(normalized.result).toBe('1');
    });

    test('api.md#normalized-type - Normalized<S> type utility', () => {
      const userSchema = new schema.Entity('users');

      // Normalized<S> extracts the normalized (flat) type - for entities, this is the ID type
      type NormalizedUser = Normalized<typeof userSchema>;
      const _idCheck: NormalizedUser = '123';
      expect(_idCheck).toBeDefined();

      // For arrays, it's an array of IDs
      const userArraySchema = new schema.Array(userSchema);
      type NormalizedUsers = Normalized<typeof userArraySchema>;
      const _arrayCheck: NormalizedUsers = ['1', '2'];
      expect(_arrayCheck).toBeDefined();

      // Runtime test
      const data = [{ id: '1' }, { id: '2' }];
      const normalized = normalize(data, userArraySchema);
      expect(normalized.result).toEqual(['1', '2']);
    });

    test('api.md#allentitiesof-type - AllEntitiesOf<S> type utility', () => {
      interface User {
        id: string;
        name: string;
      }

      interface Article {
        id: string;
        author: User;
      }

      const userSchema = new schema.Entity('users').as<User>();
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
      }).as<Article>();

      // AllEntitiesOf extracts all entity types recursively
      expectTypeOf<AllEntitiesOf<typeof articleSchema>>().toMatchTypeOf<{
        users: Record<string, User>;
        articles: Record<string, Article>;
      }>();

      // Runtime test
      const data: Article = { id: '1', author: { id: '2', name: 'Test' } };
      const normalized = normalize(data, articleSchema);
      expect(Object.keys(normalized.entities)).toContain('users');
      expect(Object.keys(normalized.entities)).toContain('articles');
    });

    test('api.md#normalizedentity-type - NormalizedEntity<TDefinition> type utility', () => {
      const userSchema = new schema.Entity('users');
      const commentSchema = new schema.Entity('comments');
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
        comments: [commentSchema],
      });

      // NormalizedEntity shows the normalized version where nested entities become IDs
      expectTypeOf<NormalizedEntity<typeof articleSchema.schema>>().toMatchTypeOf<{
        id: string | number;
        author?: string | number;
        comments?: (string | number)[];
      }>();

      // Runtime test
      const data = {
        id: '1',
        author: { id: '2' },
        comments: [{ id: 'c1' }, { id: 'c2' }],
      };
      const normalized = normalize(data, articleSchema);
      expect(normalized.entities.articles?.['1']).toEqual({
        id: '1',
        author: '2',
        comments: ['c1', 'c2'],
      });
    });
  });
});

describe('faqs.md examples', () => {
  test('faqs.md#circular-references - handling circular references', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', { author: user });

    // Circular: user has comments, comments have authors (users)
    user.define({
      comments: [comment],
    });

    // Test that circular schema definition works
    const data = {
      id: '1',
      name: 'Alice',
      comments: [{ id: 'c1', text: 'Hello', author: { id: '2', name: 'Bob' } }],
    };

    const normalized = normalize(data, user);
    expect(normalized.entities.users?.['1']).toBeDefined();
    expect(normalized.entities.users?.['2']).toBeDefined();
    expect((normalized.entities as Record<string, unknown>).comments).toBeDefined();
  });

  test('faqs.md#typescript-typing - TypeScript with .as<T>()', () => {
    interface User {
      id: string;
      name: string;
    }

    interface Article {
      id: string;
      title: string;
      author: User;
    }

    // Use .as<T>() to associate interfaces with schemas
    const userSchema = new schema.Entity('users').as<User>();
    const articleSchema = new schema.Entity('articles', {
      author: userSchema,
    }).as<Article>();

    // Get the denormalized type
    expectTypeOf<Denormalized<typeof articleSchema>>().toEqualTypeOf<Article>();

    // Get the entities store type (includes all nested entity types)
    expectTypeOf<AllEntitiesOf<typeof articleSchema>>().toMatchTypeOf<{
      users: Record<string, User>;
      articles: Record<string, Article>;
    }>();

    const data: Article = {
      id: '1',
      title: 'Test',
      author: { id: '2', name: 'Jane' },
    };

    const { result, entities } = normalize(data, articleSchema);

    expect(result).toBe('1');
    expect(entities.users?.['2']).toEqual({ id: '2', name: 'Jane' });
    expect(entities.articles?.['1']).toEqual({ id: '1', title: 'Test', author: '2' });
  });

  test('faqs.md#why-as-method - why .as<T>() preserves nested types', () => {
    interface User {
      id: string;
      name: string;
    }

    interface Article {
      id: string;
      title: string;
      author: User;
    }

    const userSchema = new schema.Entity('users').as<User>();

    // Full type inference preserved with .as<T>()
    const articleSchema = new schema.Entity('articles', {
      author: userSchema,
    }).as<Article>();

    // Verify that AllEntitiesOf correctly captures both entity types
    expectTypeOf<AllEntitiesOf<typeof articleSchema>>().toMatchTypeOf<{
      users: Record<string, User>;
      articles: Record<string, Article>;
    }>();

    const data: Article = {
      id: '1',
      title: 'Hello',
      author: { id: '2', name: 'World' },
    };

    const normalized = normalize(data, articleSchema);

    // Both users and articles should be present
    expect(Object.keys(normalized.entities).sort()).toEqual(['articles', 'users']);
  });
});

describe('README.md examples', () => {
  test('README.md#quick-start - blog post normalization', () => {
    // Sample blog post data (as shown in README)
    const originalData = {
      id: '123',
      author: {
        id: '1',
        name: 'Paul',
      },
      title: 'My awesome blog post',
      comments: [
        {
          id: '324',
          commenter: {
            id: '2',
            name: 'Nicole',
          },
        },
      ],
    };

    // Define a users schema
    const user = new schema.Entity('users');

    // Define your comments schema
    const comment = new schema.Entity('comments', {
      commenter: user,
    });

    // Define your article
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const normalizedData = normalize(originalData, article);

    expect(normalizedData).toEqual({
      result: '123',
      entities: {
        articles: {
          '123': {
            id: '123',
            author: '1',
            title: 'My awesome blog post',
            comments: ['324'],
          },
        },
        users: {
          '1': { id: '1', name: 'Paul' },
          '2': { id: '2', name: 'Nicole' },
        },
        comments: {
          '324': { id: '324', commenter: '2' },
        },
      },
    });
  });

  test('README.md#denormalization - converting normalized data back', () => {
    // Setup the same schemas as quick start
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      commenter: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const entities = {
      articles: {
        '123': {
          id: '123',
          author: '1',
          title: 'My awesome blog post',
          comments: ['324'],
        },
      },
      users: {
        '1': { id: '1', name: 'Paul' },
        '2': { id: '2', name: 'Nicole' },
      },
      comments: {
        '324': { id: '324', commenter: '2' },
      },
    };

    const denormalizedArticle = denormalize('123', article, entities);

    // Returns the original nested structure
    expect(denormalizedArticle).toEqual({
      id: '123',
      author: { id: '1', name: 'Paul' },
      title: 'My awesome blog post',
      comments: [{ id: '324', commenter: { id: '2', name: 'Nicole' } }],
    });
  });

  test('README.md#circular-references - self-referencing entities', () => {
    const user = new schema.Entity('users');
    user.define({ friends: [user] });

    // Circular data: user references themselves in friends
    const input = { id: '1', name: 'Alice', friends: [{ id: '1', name: 'Alice', friends: [] }] };

    const { result, entities } = normalize(input, user);

    // The entity should reference itself in the friends array
    expect(entities.users?.['1']).toEqual({
      id: '1',
      name: 'Alice',
      friends: ['1'],
    });

    const output = denormalize(result, user, entities);

    // Referential equality is preserved:
    expect(output).toBe((output as { friends: unknown[] }).friends[0]);
  });

  test('README.md#typescript - .as<T>() method for type inference', () => {
    interface User {
      id: string;
      name: string;
    }

    interface Article {
      id: string;
      title: string;
      author: User;
    }

    // Create schemas with .as<T>() for full type inference
    const userSchema = new schema.Entity('users').as<User>();
    const articleSchema = new schema.Entity('articles', {
      author: userSchema,
    }).as<Article>();

    // Type utilities work with full nested type information
    expectTypeOf<AllEntitiesOf<typeof articleSchema>>().toMatchTypeOf<{
      users: Record<string, User>;
      articles: Record<string, Article>;
    }>();

    // Runtime verification
    const data: Article = {
      id: '1',
      title: 'Test Article',
      author: { id: '2', name: 'John' },
    };

    const { entities } = normalize(data, articleSchema);

    expect(entities.users).toBeDefined();
    expect(entities.articles).toBeDefined();
    expect(entities.users?.['2']).toEqual({ id: '2', name: 'John' });
  });
});
