/**
 * Property-based tests for normalizr schemas.
 *
 * These tests use fast-check to generate arbitrary data conforming to
 * various schema configurations, then verify that normalize/denormalize
 * round-trips correctly. The goal is to shake out edge cases and provide
 * confidence in the normalizer implementation.
 *
 * Note: buildConstraintsForSchema generates arrays with unique entity IDs,
 * so we don't need to deduplicate in the tests.
 */
import { describe, expect, test } from 'vitest';
import { denormalize, normalize, schema } from '../../src/index.js';
import fc from 'fast-check';

/**
 * Generate safe ID strings that avoid problematic JavaScript keys
 * like __proto__, constructor, etc.
 */
const safeIdArbitrary = fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/);

/**
 * Check if a schema will produce objects with an `id` field.
 * Used to determine if we need unique ID constraints for arrays.
 */
function schemaProducesEntities(Schema: unknown): boolean {
  if (Schema instanceof schema.Entity) return true;
  if (Schema instanceof schema.Union) return true;
  // Array shorthand containing an entity
  if (Array.isArray(Schema) && Schema.length === 1) {
    return schemaProducesEntities(Schema[0]);
  }
  return false;
}

/**
 * Build an array arbitrary, using uniqueArray when the inner schema produces entities.
 */
function buildArrayArbitrary(innerSchema: unknown, maxLength = 5): fc.Arbitrary<unknown[]> {
  const itemArb = buildConstraintsForSchema(innerSchema);

  if (schemaProducesEntities(innerSchema)) {
    // Use uniqueArray with id selector to ensure unique entity IDs
    return fc.uniqueArray(itemArb as fc.Arbitrary<{ id: string }>, {
      maxLength,
      selector: (item) => item.id,
    });
  }

  return fc.array(itemArb, { maxLength });
}

/**
 * Given a normalizr schema, build a fast-check arbitrary that can
 * be used to generate objects that conform to the schema.
 *
 * Supports:
 * - schema.Entity - generates objects with id + nested schema fields
 * - schema.Array - generates arrays of items matching the inner schema (unique IDs)
 * - schema.Values - generates dictionaries with values matching the inner schema (unique IDs)
 * - schema.Object - generates objects matching the schema definition
 * - schema.Union - generates one of the possible union types
 *
 * ## Uniqueness Limitation
 *
 * This generator ensures unique entity IDs **within each array**, but cannot
 * guarantee uniqueness **across different fields or nested structures**. For example:
 *
 * ```typescript
 * {
 *   posts: [{ id: "A", comments: [{ id: "1" }] },
 *           { id: "B", comments: [{ id: "1" }] }],  // comment "1" in both!
 *   featuredPost: { id: "A", ... }                  // same ID as posts[0]!
 * }
 * ```
 *
 * Each array is generated independently by fast-check, so they don't share state.
 * Normalizr merges entities by ID, so duplicate IDs with different data will cause
 * round-trip tests to fail. Tests for complex structures with multiple references
 * to the same entity type should filter out or skip conflicting cases.
 * - Array shorthand [schema] - generates arrays (unique IDs for entities)
 * - Object shorthand { key: schema } - generates matching objects
 */
export function buildConstraintsForSchema(Schema: unknown): fc.Arbitrary<unknown> {
  // Handle Entity schema
  if (Schema instanceof schema.Entity) {
    const constraintsObj: Record<string, fc.Arbitrary<unknown>> = {
      // Entity always needs an id - generate safe alphanumeric IDs
      id: safeIdArbitrary,
    };

    const entitySchema = Schema.schema as Record<string, unknown>;
    for (const [key, Subschema] of Object.entries(entitySchema)) {
      constraintsObj[key] = buildConstraintsForSchema(Subschema);
    }

    return fc.record(constraintsObj);
  }

  // Handle Array schema (extends PolymorphicSchema)
  if (Schema instanceof schema.Array) {
    const innerSchema = (Schema as { schema: unknown }).schema;
    const schemaAttribute = (Schema as unknown as { _schemaAttribute?: unknown })._schemaAttribute;

    // Check if it's a polymorphic array (has schemaAttribute and mapping of schemas)
    if (schemaAttribute && typeof innerSchema === 'object' && innerSchema !== null) {
      const schemaMapping = innerSchema as Record<string, unknown>;
      const entries = Object.entries(schemaMapping);

      if (entries.length === 0) {
        return fc.array(fc.anything());
      }

      // Generate items that could be any of the union types
      // For polymorphic schemas, include a type discriminator
      const arbitraries = entries.map(([schemaKey, s]) => {
        const itemArb = buildConstraintsForSchema(s);
        // Add the schema attribute to identify the type
        return itemArb.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return { ...item, type: schemaKey };
          }
          return item;
        });
      });

      // For polymorphic arrays, use uniqueArray with id selector
      return fc.uniqueArray(
        fc.oneof(...(arbitraries as [fc.Arbitrary<{ id: string }>, ...fc.Arbitrary<{ id: string }>[]])),
        { maxLength: 5, selector: (item) => item.id },
      );
    }

    // Simple array with single schema
    return buildArrayArbitrary(innerSchema);
  }

  // Handle Values schema (extends PolymorphicSchema)
  if (Schema instanceof schema.Values) {
    const innerSchema = (Schema as { schema: unknown }).schema;
    const schemaAttribute = (Schema as unknown as { _schemaAttribute?: unknown })._schemaAttribute;

    // Check if it's a polymorphic values schema
    if (schemaAttribute && typeof innerSchema === 'object' && innerSchema !== null) {
      const schemaMapping = innerSchema as Record<string, unknown>;
      const entries = Object.entries(schemaMapping);

      if (entries.length === 0) {
        return fc.dictionary(safeIdArbitrary, fc.anything());
      }

      // Generate values that could be any of the union types
      const arbitraries = entries.map(([schemaKey, s]) => {
        const valueArb = buildConstraintsForSchema(s);
        return valueArb.map((value) => {
          if (typeof value === 'object' && value !== null) {
            return { ...value, type: schemaKey };
          }
          return value;
        });
      });

      // Use uniqueArray then convert to dictionary to ensure unique IDs
      const itemArb = fc.oneof(...(arbitraries as [fc.Arbitrary<{ id: string }>, ...fc.Arbitrary<{ id: string }>[]]));
      return fc
        .uniqueArray(fc.tuple(safeIdArbitrary, itemArb), {
          maxLength: 5,
          selector: ([, item]) => item.id,
        })
        .map((pairs) => Object.fromEntries(pairs));
    }

    // Simple values with single schema - ensure unique entity IDs
    if (schemaProducesEntities(innerSchema)) {
      const itemArb = buildConstraintsForSchema(innerSchema) as fc.Arbitrary<{ id: string }>;
      return fc
        .uniqueArray(fc.tuple(safeIdArbitrary, itemArb), {
          maxLength: 5,
          selector: ([, item]) => item.id,
        })
        .map((pairs) => Object.fromEntries(pairs));
    }

    return fc.dictionary(safeIdArbitrary, buildConstraintsForSchema(innerSchema));
  }

  // Handle Union schema (extends PolymorphicSchema)
  if (Schema instanceof schema.Union) {
    const schemaMapping = (Schema as { schema: unknown }).schema as Record<string, unknown>;
    const entries = Object.entries(schemaMapping);

    if (entries.length === 0) {
      return fc.anything();
    }

    // Generate one of the possible union types with type discriminator
    const arbitraries = entries.map(([schemaKey, s]) => {
      const itemArb = buildConstraintsForSchema(s);
      // Add the type discriminator for the union
      return itemArb.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return { ...item, type: schemaKey };
        }
        return item;
      });
    });

    return fc.oneof(...(arbitraries as [fc.Arbitrary<unknown>, ...fc.Arbitrary<unknown>[]]));
  }

  // Handle Object schema
  if (Schema instanceof schema.Object) {
    const constraintsObj: Record<string, fc.Arbitrary<unknown>> = {};
    const objectSchema = Schema.schema as Record<string, unknown>;

    for (const [key, Subschema] of Object.entries(objectSchema)) {
      constraintsObj[key] = buildConstraintsForSchema(Subschema);
    }

    return fc.record(constraintsObj);
  }

  // Handle array shorthand: [schema]
  if (Array.isArray(Schema) && Schema.length === 1) {
    return buildArrayArbitrary(Schema[0]);
  }

  // Handle object shorthand: { key: schema }
  if (typeof Schema === 'object' && Schema !== null && !Array.isArray(Schema)) {
    const constraintsObj: Record<string, fc.Arbitrary<unknown>> = {};
    for (const [key, value] of Object.entries(Schema)) {
      constraintsObj[key] = buildConstraintsForSchema(value);
    }
    return fc.record(constraintsObj);
  }

  // Base case: generate arbitrary primitive values
  // This handles cases where we hit a leaf node or unknown schema type
  return fc.oneof(fc.string({ maxLength: 20 }), fc.integer({ min: -1000, max: 1000 }), fc.boolean(), fc.constant(null));
}

describe('Property-based schema tests', () => {
  describe('schema.Entity', () => {
    test('flat entity round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const userArb = buildConstraintsForSchema(userSchema);

      fc.assert(
        fc.property(userArb, (user: any) => {
          const normalized = normalize(user, userSchema);
          const denormalized = denormalize(normalized.result, userSchema, normalized.entities);
          expect(denormalized).toEqual(user);
        }),
      );
    });

    test('entity with nested entity round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
      });
      const articleArb = buildConstraintsForSchema(articleSchema);

      fc.assert(
        fc.property(articleArb, (article: any) => {
          const normalized = normalize(article, articleSchema);
          const denormalized = denormalize(normalized.result, articleSchema, normalized.entities);
          expect(denormalized).toEqual(article);
        }),
      );
    });

    test('entity with array of nested entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const teamSchema = new schema.Entity('teams', {
        members: [userSchema],
      });
      const teamArb = buildConstraintsForSchema(teamSchema);

      fc.assert(
        fc.property(teamArb, (team: any) => {
          const normalized = normalize(team, teamSchema);
          const denormalized = denormalize(normalized.result, teamSchema, normalized.entities);
          expect(denormalized).toEqual(team);
        }),
      );
    });

    test('deeply nested entities round-trip correctly', () => {
      const userSchema = new schema.Entity('users');
      const commentSchema = new schema.Entity('comments', {
        author: userSchema,
      });
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
        comments: [commentSchema],
      });
      const articleArb = buildConstraintsForSchema(articleSchema);

      fc.assert(
        fc.property(articleArb, (article: any) => {
          const normalized = normalize(article, articleSchema);
          const denormalized = denormalize(normalized.result, articleSchema, normalized.entities);
          expect(denormalized).toEqual(article);
        }),
      );
    });
  });

  describe('schema.Array', () => {
    test('array of entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const usersArraySchema = new schema.Array(userSchema);
      const usersArb = buildConstraintsForSchema(usersArraySchema);

      fc.assert(
        fc.property(usersArb, (users: any) => {
          const normalized = normalize(users, usersArraySchema);
          const denormalized = denormalize(normalized.result, usersArraySchema, normalized.entities);
          expect(denormalized).toEqual(users);
        }),
      );
    });

    test('array shorthand [schema] round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const usersArb = buildConstraintsForSchema([userSchema]);

      fc.assert(
        fc.property(usersArb, (users: any) => {
          const normalized = normalize(users, [userSchema]);
          const denormalized = denormalize(normalized.result, [userSchema], normalized.entities);
          expect(denormalized).toEqual(users);
        }),
      );
    });

    test('array of nested entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
      });
      const articlesArraySchema = new schema.Array(articleSchema);
      const articlesArb = buildConstraintsForSchema(articlesArraySchema);

      fc.assert(
        fc.property(articlesArb, (articles: any) => {
          const normalized = normalize(articles, articlesArraySchema);
          const denormalized = denormalize(normalized.result, articlesArraySchema, normalized.entities);
          expect(denormalized).toEqual(articles);
        }),
      );
    });
  });

  describe('schema.Object', () => {
    test('object with single nested entity round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const responseSchema = new schema.Object({
        user: userSchema,
      });
      const responseArb = buildConstraintsForSchema(responseSchema);

      fc.assert(
        fc.property(responseArb, (response: any) => {
          const normalized = normalize(response, responseSchema);
          const denormalized = denormalize(normalized.result, responseSchema, normalized.entities);
          expect(denormalized).toEqual(response);
        }),
      );
    });

    test('object with multiple nested entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const articleSchema = new schema.Entity('articles');
      const responseSchema = new schema.Object({
        currentUser: userSchema,
        featuredArticle: articleSchema,
      });
      const responseArb = buildConstraintsForSchema(responseSchema);

      fc.assert(
        fc.property(responseArb, (response: any) => {
          const normalized = normalize(response, responseSchema);
          const denormalized = denormalize(normalized.result, responseSchema, normalized.entities);
          expect(denormalized).toEqual(response);
        }),
      );
    });

    test('object shorthand { key: schema } round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const shorthandSchema = { user: userSchema };
      const responseArb = buildConstraintsForSchema(shorthandSchema);

      fc.assert(
        fc.property(responseArb, (response: any) => {
          const normalized = normalize(response, shorthandSchema);
          const denormalized = denormalize(normalized.result, shorthandSchema, normalized.entities);
          expect(denormalized).toEqual(response);
        }),
      );
    });

    test('object with array of entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const responseSchema = new schema.Object({
        users: [userSchema],
      });
      const responseArb = buildConstraintsForSchema(responseSchema);

      fc.assert(
        fc.property(responseArb, (response: any) => {
          const normalized = normalize(response, responseSchema);
          const denormalized = denormalize(normalized.result, responseSchema, normalized.entities);
          expect(denormalized).toEqual(response);
        }),
      );
    });
  });

  describe('schema.Values', () => {
    test('values schema with entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const usersMapSchema = new schema.Values(userSchema);
      const usersMapArb = buildConstraintsForSchema(usersMapSchema);

      fc.assert(
        fc.property(usersMapArb, (usersMap: any) => {
          const normalized = normalize(usersMap, usersMapSchema);
          const denormalized = denormalize(normalized.result, usersMapSchema, normalized.entities);
          expect(denormalized).toEqual(usersMap);
        }),
      );
    });

    test('values schema with nested entities round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
      });
      const articlesMapSchema = new schema.Values(articleSchema);
      const articlesMapArb = buildConstraintsForSchema(articlesMapSchema);

      fc.assert(
        fc.property(articlesMapArb, (articlesMap: any) => {
          const normalized = normalize(articlesMap, articlesMapSchema);
          const denormalized = denormalize(normalized.result, articlesMapSchema, normalized.entities);
          expect(denormalized).toEqual(articlesMap);
        }),
      );
    });
  });

  describe('schema.Union', () => {
    test('union schema round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const groupSchema = new schema.Entity('groups');
      const ownerSchema = new schema.Union(
        {
          user: userSchema,
          group: groupSchema,
        },
        'type',
      );
      const ownerArb = buildConstraintsForSchema(ownerSchema);

      fc.assert(
        fc.property(ownerArb, (owner: any) => {
          const normalized = normalize(owner, ownerSchema);
          const denormalized = denormalize(normalized.result, ownerSchema, normalized.entities);
          expect(denormalized).toEqual(owner);
        }),
      );
    });

    test('entity with union field round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const groupSchema = new schema.Entity('groups');
      const ownerSchema = new schema.Union(
        {
          user: userSchema,
          group: groupSchema,
        },
        'type',
      );
      const resourceSchema = new schema.Entity('resources', {
        owner: ownerSchema,
      });
      const resourceArb = buildConstraintsForSchema(resourceSchema);

      fc.assert(
        fc.property(resourceArb, (resource: any) => {
          const normalized = normalize(resource, resourceSchema);
          const denormalized = denormalize(normalized.result, resourceSchema, normalized.entities);
          expect(denormalized).toEqual(resource);
        }),
      );
    });

    test('array of unions round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const groupSchema = new schema.Entity('groups');
      const ownerSchema = new schema.Union(
        {
          user: userSchema,
          group: groupSchema,
        },
        'type',
      );
      const ownersArraySchema = new schema.Array(ownerSchema);
      const ownersArb = buildConstraintsForSchema(ownersArraySchema);

      fc.assert(
        fc.property(ownersArb, (owners: any) => {
          const normalized = normalize(owners, ownersArraySchema);
          const denormalized = denormalize(normalized.result, ownersArraySchema, normalized.entities);
          expect(denormalized).toEqual(owners);
        }),
      );
    });
  });

  describe('Complex nested structures', () => {
    test('blog-like structure round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const commentSchema = new schema.Entity('comments', {
        author: userSchema,
      });
      const articleSchema = new schema.Entity('articles', {
        author: userSchema,
        comments: [commentSchema],
      });
      const blogSchema = new schema.Object({
        posts: [articleSchema],
        featuredPost: articleSchema,
        admin: userSchema,
      });
      const blogArb = buildConstraintsForSchema(blogSchema);

      fc.assert(
        fc.property(blogArb, (blog: any) => {
          // Skip if article IDs conflict between posts and featuredPost
          const postIds = new Set(blog.posts.map((p: any) => p.id));
          if (postIds.has(blog.featuredPost.id) && blog.posts.length > 0) return;

          // Skip if comment IDs conflict across different articles
          const allCommentIds = new Set<string>();
          const allComments = [...blog.posts.flatMap((p: any) => p.comments), ...blog.featuredPost.comments];
          for (const comment of allComments) {
            if (allCommentIds.has(comment.id)) return;
            allCommentIds.add(comment.id);
          }

          const normalized = normalize(blog, blogSchema);
          const denormalized = denormalize(normalized.result, blogSchema, normalized.entities);
          expect(denormalized).toEqual(blog);
        }),
      );
    });

    test('e-commerce-like structure round-trips correctly', () => {
      const categorySchema = new schema.Entity('categories');
      const productSchema = new schema.Entity('products', {
        category: categorySchema,
      });
      const orderItemSchema = new schema.Entity('orderItems', {
        product: productSchema,
      });
      const userSchema = new schema.Entity('users');
      const orderSchema = new schema.Entity('orders', {
        customer: userSchema,
        items: [orderItemSchema],
      });
      const orderArb = buildConstraintsForSchema(orderSchema);

      fc.assert(
        fc.property(orderArb, (order: any) => {
          // Skip if products conflict across order items
          const productIds = new Set<string>();
          for (const item of order.items) {
            if (productIds.has(item.product.id)) return;
            productIds.add(item.product.id);
          }

          // Skip if categories conflict across products
          const categoryIds = new Set<string>();
          for (const item of order.items) {
            if (categoryIds.has(item.product.category.id)) return;
            categoryIds.add(item.product.category.id);
          }

          const normalized = normalize(order, orderSchema);
          const denormalized = denormalize(normalized.result, orderSchema, normalized.entities);
          expect(denormalized).toEqual(order);
        }),
      );
    });

    test('social-network-like structure with values round-trips correctly', () => {
      const userSchema = new schema.Entity('users');
      const postSchema = new schema.Entity('posts', {
        author: userSchema,
      });
      const feedSchema = new schema.Object({
        postsByDate: new schema.Values(postSchema),
        currentUser: userSchema,
      });
      const feedArb = buildConstraintsForSchema(feedSchema);

      fc.assert(
        fc.property(feedArb, (feed: any) => {
          const normalized = normalize(feed, feedSchema);
          const denormalized = denormalize(normalized.result, feedSchema, normalized.entities);
          expect(denormalized).toEqual(feed);
        }),
      );
    });
  });
});
