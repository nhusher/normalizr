import { describe, test, expect, vi } from 'vitest';
import { denormalize, normalize, schema } from '../src/index.js';

describe('normalize', () => {
  [42, null, undefined, '42', () => {}].forEach((input) => {
    test(`cannot normalize input that == ${input}`, () => {
      // @ts-expect-error - testing invalid input types
      expect(() => normalize(input, new schema.Entity('test'))).toThrow();
    });
  });

  test('cannot normalize with null input', () => {
    const mySchema = new schema.Entity('tacos');
    // @ts-expect-error - testing invalid input type
    expect(() => normalize(null, mySchema)).toThrow(/null/);
  });

  test('normalizes entities', () => {
    const mySchema = new schema.Entity('tacos');

    expect(
      normalize(
        [
          { id: 1, type: 'foo' },
          { id: 2, type: 'bar' },
        ],
        [mySchema],
      ),
    ).toEqual({
      entities: {
        tacos: {
          1: { id: 1, type: 'foo' },
          2: { id: 2, type: 'bar' },
        },
      },
      result: [1, 2],
    });
  });

  test('normalizes entities with circular references', () => {
    const user = new schema.Entity('users');
    user.define({
      friends: [user],
    });

    const input: { id: number; friends: unknown[] } = { id: 123, friends: [] };
    input.friends.push(input);

    expect(normalize(input, user)).toEqual({
      entities: {
        users: {
          123: {
            friends: [123],
            id: 123,
          },
        },
      },
      result: 123,
    });
  });

  test('normalizes nested entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const input = {
      id: '123',
      title: 'A Great Article',
      author: {
        id: '8472',
        name: 'Paul',
      },
      body: 'This article is great.',
      comments: [
        {
          id: 'comment-123-4738',
          comment: 'I like it!',
          user: {
            id: '10293',
            name: 'Jane',
          },
        },
      ],
    };
    expect(normalize(input, article)).toEqual({
      entities: {
        articles: {
          123: {
            author: '8472',
            body: 'This article is great.',
            comments: ['comment-123-4738'],
            id: '123',
            title: 'A Great Article',
          },
        },
        comments: {
          'comment-123-4738': {
            comment: 'I like it!',
            id: 'comment-123-4738',
            user: '10293',
          },
        },
        users: {
          10293: {
            id: '10293',
            name: 'Jane',
          },
          8472: {
            id: '8472',
            name: 'Paul',
          },
        },
      },
      result: '123',
    });
  });

  test('does not modify the original input', () => {
    const user = new schema.Entity('users');
    const article = new schema.Entity('articles', { author: user });
    const input = Object.freeze({
      id: '123',
      title: 'A Great Article',
      author: Object.freeze({
        id: '8472',
        name: 'Paul',
      }),
    });
    expect(() => normalize(input, article)).not.toThrow();
  });

  test('ignores null values', () => {
    const myEntity = new schema.Entity('myentities');
    expect(normalize([null] as any, [myEntity])).toEqual({
      entities: {},
      result: [null],
    });
    expect(normalize([undefined] as any, [myEntity])).toEqual({
      entities: {},
      result: [undefined],
    });
    expect(normalize([false] as any, [myEntity])).toEqual({
      entities: {},
      result: [false],
    });
  });

  test('can use fully custom entity classes', () => {
    class MyEntity extends schema.Entity {
      override schema = {
        children: [new schema.Entity('children')],
      };

      override getId(entity: Record<string, unknown>) {
        return entity.uuid as string;
      }

      // @ts-expect-error - intentionally using non-standard return type for testing
      override normalize(
        input: Record<string, unknown>,
        parent: unknown,
        key: string | undefined,
        visit: (...args: unknown[]) => unknown,
        addEntity: (...args: unknown[]) => void,
        visitedEntities: Record<string, Record<string | number, unknown[]>>,
      ) {
        const entity = { ...input };
        Object.keys(this.schema).forEach((schemaKey) => {
          const nestedSchema = this.schema[schemaKey as keyof typeof this.schema];
          entity[schemaKey] = visit(input[schemaKey], input, schemaKey, nestedSchema, addEntity, visitedEntities);
        });
        addEntity(this, entity, parent, key);
        return {
          uuid: this.getId(entity),
          schema: this.key,
        };
      }
    }

    const mySchema = new MyEntity('food') as any;
    expect(
      normalize(
        {
          uuid: '1234',
          name: 'tacos',
          children: [{ id: 4, name: 'lettuce' }],
        },
        mySchema,
      ),
    ).toEqual({
      entities: {
        children: {
          4: {
            id: 4,
            name: 'lettuce',
          },
        },
        food: {
          1234: {
            children: [4],
            name: 'tacos',
            uuid: '1234',
          },
        },
      },
      result: {
        schema: 'food',
        uuid: '1234',
      },
    });
  });

  test('uses the non-normalized input when getting the ID for an entity', () => {
    const userEntity = new schema.Entity('users');
    const idAttributeFn = vi.fn((nonNormalized: { user: { id: string } }) => nonNormalized.user.id);
    const recommendation = new schema.Entity(
      'recommendations',
      { user: userEntity },
      {
        idAttribute: idAttributeFn,
      },
    );
    expect(normalize({ user: { id: '456' } }, recommendation)).toEqual({
      entities: {
        recommendations: {
          456: {
            user: '456',
          },
        },
        users: {
          456: {
            id: '456',
          },
        },
      },
      result: '456',
    });
    expect(idAttributeFn).toHaveBeenCalledTimes(2);
    expect(recommendation.idAttribute).toBe(idAttributeFn);
  });

  test('passes over pre-normalized values', () => {
    const userEntity = new schema.Entity('users');
    const articleEntity = new schema.Entity('articles', { author: userEntity });

    expect(normalize({ id: '123', title: 'normalizr is great!', author: 1 }, articleEntity)).toEqual({
      entities: {
        articles: {
          123: {
            author: 1,
            id: '123',
            title: 'normalizr is great!',
          },
        },
      },
      result: '123',
    });
  });

  test('can normalize object without proper object prototype inheritance', () => {
    const testData: { id: number; elements: Record<string, unknown>[] } = {
      id: 1,
      elements: [],
    };
    testData.elements.push(
      Object.assign(Object.create(null), {
        id: 18,
        name: 'test',
      }),
    );

    const testEntity = new schema.Entity('test', {
      elements: [new schema.Entity('elements')],
    });

    expect(() => normalize(testData, testEntity)).not.toThrow();
  });

  test('can normalize entity nested inside entity using property from parent', () => {
    const linkablesSchema = new schema.Entity('linkables');
    const mediaSchema = new schema.Entity('media');
    const listsSchema = new schema.Entity('lists');

    const schemaMap: Record<string, typeof mediaSchema | typeof listsSchema> = {
      media: mediaSchema,
      lists: listsSchema,
    };

    linkablesSchema.define({
      data: (parent: { schema_type: string }) => schemaMap[parent.schema_type],
    });

    const input = {
      id: 1,
      module_type: 'article',
      schema_type: 'media',
      data: {
        id: 2,
        url: 'catimage.jpg',
      },
    };

    expect(normalize(input, linkablesSchema)).toEqual({
      entities: {
        linkables: {
          1: {
            data: 2,
            id: 1,
            module_type: 'article',
            schema_type: 'media',
          },
        },
        media: {
          2: {
            id: 2,
            url: 'catimage.jpg',
          },
        },
      },
      result: 1,
    });
  });

  test('can normalize entity nested inside object using property from parent', () => {
    const mediaSchema = new schema.Entity('media');
    const listsSchema = new schema.Entity('lists');

    const schemaMap: Record<string, typeof mediaSchema | typeof listsSchema> = {
      media: mediaSchema,
      lists: listsSchema,
    };

    const linkablesSchema = {
      data: (parent: unknown) => schemaMap[(parent as { schema_type: string }).schema_type],
    };

    const input = {
      id: 1,
      module_type: 'article',
      schema_type: 'media',
      data: {
        id: 2,
        url: 'catimage.jpg',
      },
    };

    expect(normalize(input as any, linkablesSchema)).toEqual({
      entities: {
        media: {
          2: {
            id: 2,
            url: 'catimage.jpg',
          },
        },
      },
      result: {
        data: 2,
        id: 1,
        module_type: 'article',
        schema_type: 'media',
      },
    });
  });
});

describe('denormalize', () => {
  test('returns the input if undefined', () => {
    expect(denormalize(undefined as any, {}, {})).toBeUndefined();
  });

  test('denormalizes entities', () => {
    const mySchema = new schema.Entity('tacos');
    const entities = {
      tacos: {
        1: { id: 1, type: 'foo' },
        2: { id: 2, type: 'bar' },
      },
    };
    expect(denormalize([1, 2], [mySchema], entities)).toEqual([
      { id: 1, type: 'foo' },
      { id: 2, type: 'bar' },
    ]);
  });

  test('denormalizes nested entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const entities = {
      articles: {
        123: {
          author: '8472',
          body: 'This article is great.',
          comments: ['comment-123-4738'],
          id: '123',
          title: 'A Great Article',
        },
      },
      comments: {
        'comment-123-4738': {
          comment: 'I like it!',
          id: 'comment-123-4738',
          user: '10293',
        },
      },
      users: {
        10293: {
          id: '10293',
          name: 'Jane',
        },
        8472: {
          id: '8472',
          name: 'Paul',
        },
      },
    };
    expect(denormalize('123', article, entities)).toEqual({
      author: {
        id: '8472',
        name: 'Paul',
      },
      body: 'This article is great.',
      comments: [
        {
          comment: 'I like it!',
          id: 'comment-123-4738',
          user: {
            id: '10293',
            name: 'Jane',
          },
        },
      ],
      id: '123',
      title: 'A Great Article',
    });
  });

  test('set to undefined if schema key is not in entities', () => {
    const user = new schema.Entity('users');
    const comment = new schema.Entity('comments', {
      user: user,
    });
    const article = new schema.Entity('articles', {
      author: user,
      comments: [comment],
    });

    const entities = {
      articles: {
        123: {
          id: '123',
          author: '8472',
          comments: ['1'],
        },
      },
      comments: {
        1: {
          user: '123',
        },
      },
    };
    expect(denormalize('123', article, entities)).toEqual({
      author: undefined,
      comments: [
        {
          user: undefined,
        },
      ],
      id: '123',
    });
  });

  test('does not modify the original entities', () => {
    const user = new schema.Entity('users');
    const article = new schema.Entity('articles', { author: user });
    const entities = Object.freeze({
      articles: Object.freeze({
        123: Object.freeze({
          id: '123',
          title: 'A Great Article',
          author: '8472',
        }),
      }),
      users: Object.freeze({
        8472: Object.freeze({
          id: '8472',
          name: 'Paul',
        }),
      }),
    });
    expect(() => denormalize('123', article, entities)).not.toThrow();
  });

  test('denormalizes with function as idAttribute', () => {
    const normalizedData = {
      entities: {
        patrons: {
          1: { id: '1', guest: null, name: 'Esther' },
          2: { id: '2', guest: 'guest-2-1', name: 'Tom' },
        },
        guests: { 'guest-2-1': { guest_id: 1 } },
      },
      result: ['1', '2'],
    };

    const guestSchema = new schema.Entity(
      'guests',
      {},
      {
        idAttribute: (value: { guest_id: number }, parent: unknown, key: string | undefined) =>
          `${key}-${(parent as { id: string }).id}-${value.guest_id}`,
      },
    );

    const patronsSchema = new schema.Entity('patrons', {
      guest: guestSchema,
    });

    expect(denormalize(normalizedData.result, [patronsSchema], normalizedData.entities)).toEqual([
      {
        guest: null,
        id: '1',
        name: 'Esther',
      },
      {
        guest: {
          guest_id: 1,
        },
        id: '2',
        name: 'Tom',
      },
    ]);
  });

  test('denormalizes circular data with referential equality', () => {
    const user = new schema.Entity('users');
    user.define({
      friends: [user],
    });

    // Create circular input data: user is their own friend
    const input: { id: number; name: string; friends: unknown[] } = {
      id: 123,
      name: 'Alice',
      friends: [],
    };
    input.friends.push(input);

    // Normalize the circular data
    const { result, entities } = normalize(input, user);

    // Denormalize back
    const output = denormalize(result, user, entities) as {
      id: number;
      name: string;
      friends: unknown[];
    };

    // Verify the denormalized structure
    expect(output.id).toBe(123);
    expect(output.name).toBe('Alice');
    expect(output.friends).toHaveLength(1);

    // Verify referential equality: the user should be the same object as their friend
    expect(output).toBe(output.friends[0]);
  });
});
