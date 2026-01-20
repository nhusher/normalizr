import { describe, test, expect } from 'vitest';
import { denormalize, normalize, schema } from '../../src/index.js';

const values = <T>(obj: Record<string, T>): T[] => Object.keys(obj).map((key) => obj[key]);

describe(`${schema.Entity.name} normalization`, () => {
  test('normalizes an entity', () => {
    const entity = new schema.Entity('item');
    expect(normalize({ id: 1 }, entity)).toEqual({
      entities: {
        item: {
          1: { id: 1 },
        },
      },
      result: 1,
    });
  });

  describe('key', () => {
    test('must be created with a key name', () => {
      // @ts-expect-error - testing runtime error
      expect(() => new schema.Entity()).toThrow();
    });

    test('key name must be a string', () => {
      // @ts-expect-error - testing runtime error
      expect(() => new schema.Entity(42)).toThrow();
    });

    test('key getter should return key passed to constructor', () => {
      const user = new schema.Entity('users');
      expect(user.key).toEqual('users');
    });
  });

  describe('idAttribute', () => {
    test('can use a custom idAttribute string', () => {
      const user = new schema.Entity('users', {}, { idAttribute: 'id_str' });
      expect(normalize({ id_str: '134351', name: 'Kathy' }, user)).toEqual({
        entities: {
          users: {
            134351: {
              id_str: '134351',
              name: 'Kathy',
            },
          },
        },
        result: '134351',
      });
    });

    test('can normalize entity IDs based on their object key', () => {
      const user = new schema.Entity('users', {}, { idAttribute: (_entity, _parent, key) => key! });
      const inputSchema = new schema.Values({ users: user }, () => 'users');

      expect(normalize({ 4: { name: 'taco' }, 56: { name: 'burrito' } }, inputSchema)).toEqual({
        entities: {
          users: {
            4: { name: 'taco' },
            56: { name: 'burrito' },
          },
        },
        result: {
          4: { id: '4', schema: 'users' },
          56: { id: '56', schema: 'users' },
        },
      });
    });

    test("can build the entity's ID from the parent object", () => {
      const user = new schema.Entity(
        'users',
        {},
        {
          idAttribute: (entity, parent, key) =>
            `${(parent as { name: string }).name}-${key}-${(entity as { id: string }).id}`,
        },
      );
      const inputSchema = new schema.Object({ user });

      expect(normalize({ name: 'tacos', user: { id: '4', name: 'Jimmy' } }, inputSchema)).toEqual({
        entities: {
          users: {
            'tacos-user-4': {
              id: '4',
              name: 'Jimmy',
            },
          },
        },
        result: {
          name: 'tacos',
          user: 'tacos-user-4',
        },
      });
    });
  });

  describe('mergeStrategy', () => {
    test('defaults to plain merging', () => {
      const mySchema = new schema.Entity('tacos');
      expect(
        normalize(
          [
            { id: 1, name: 'foo' },
            { id: 1, name: 'bar', alias: 'bar' },
          ],
          [mySchema],
        ),
      ).toEqual({
        entities: {
          tacos: {
            1: {
              alias: 'bar',
              id: 1,
              name: 'bar',
            },
          },
        },
        result: [1, 1],
      });
    });

    test('can use a custom merging strategy', () => {
      const mergeStrategy = (entityA: { name: string }, entityB: { name: string }) => {
        return { ...entityA, ...entityB, name: entityA.name };
      };

      type Taco = { id: number; name: string; alias?: string };
      const mySchema = new schema.Entity('tacos', {}, { mergeStrategy }).as<Taco>();

      expect(
        normalize(
          [
            { id: 1, name: 'foo' },
            { id: 1, name: 'bar', alias: 'bar' },
          ],
          [mySchema],
        ),
      ).toEqual({
        entities: {
          tacos: {
            1: {
              alias: 'bar',
              id: 1,
              name: 'foo',
            },
          },
        },
        result: [1, 1],
      });
    });
  });

  describe('processStrategy', () => {
    test('can use a custom processing strategy', () => {
      const processStrategy = (entity: { id: number }) => {
        return { ...entity, slug: `thing-${entity.id}` };
      };

      type Taco = { id: number; name: string };
      const mySchema = new schema.Entity('tacos', {}, { processStrategy }).as<Taco>();

      expect(normalize({ id: 1, name: 'foo' }, mySchema)).toEqual({
        entities: {
          tacos: {
            1: {
              id: 1,
              name: 'foo',
              slug: 'thing-1',
            },
          },
        },
        result: 1,
      });
    });

    test('can use information from the parent in the process strategy', () => {
      const processStrategy = (entity: unknown, parent: unknown, key: string | undefined) => {
        return { ...(entity as object), parentId: (parent as { id: number }).id, parentKey: key };
      };
      const childEntity = new schema.Entity('children', {}, { processStrategy });
      const parentEntity = new schema.Entity('parents', {
        child: childEntity,
      });

      expect(
        normalize(
          {
            id: 1,
            content: 'parent',
            child: { id: 4, content: 'child' },
          },
          parentEntity,
        ),
      ).toEqual({
        entities: {
          children: {
            4: {
              content: 'child',
              id: 4,
              parentId: 1,
              parentKey: 'child',
            },
          },
          parents: {
            1: {
              child: 4,
              content: 'parent',
              id: 1,
            },
          },
        },
        result: 1,
      });
    });

    test('is run before and passed to the schema normalization', () => {
      const processStrategy = (input: unknown) => ({
        ...values(input as Record<string, Record<string, unknown>>)[0],
        type: Object.keys(input as object)[0],
      });
      const attachmentEntity = new schema.Entity('attachments');
      // If not run before, this schema would require a parent object with key "message"
      const myEntity = new schema.Entity(
        'entries',
        {
          data: { attachment: attachmentEntity },
        },
        {
          idAttribute: (input) => values(input as unknown as Record<string, { id: string }>)[0].id,
          processStrategy,
        },
      );

      expect(normalize({ message: { id: '123', data: { attachment: { id: '456' } } } } as any, myEntity)).toEqual({
        entities: {
          attachments: {
            456: {
              id: '456',
            },
          },
          entries: {
            123: {
              data: {
                attachment: '456',
              },
              id: '123',
              type: 'message',
            },
          },
        },
        result: '123',
      });
    });
  });
});

describe(`${schema.Entity.name} denormalization`, () => {
  test('denormalizes an entity', () => {
    const mySchema = new schema.Entity('tacos');
    const entities = {
      tacos: {
        1: { id: 1, type: 'foo' },
      },
    };
    expect(denormalize(1, mySchema, entities)).toEqual({
      id: 1,
      type: 'foo',
    });
  });

  test('denormalizes deep entities', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema,
    });

    const entities = {
      menus: {
        1: { id: 1, food: 1 },
        2: { id: 2 },
      },
      foods: {
        1: { id: 1 },
      },
    };

    expect(denormalize(1, menuSchema, entities)).toEqual({
      food: { id: 1 },
      id: 1,
    });
    expect(denormalize(2, menuSchema, entities)).toEqual({
      id: 2,
    });
  });

  test('denormalizes to undefined for missing data', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema,
    });

    const entities = {
      menus: {
        1: { id: 1, food: 2 },
      },
      foods: {
        1: { id: 1 },
      },
    };

    expect(denormalize(1, menuSchema, entities)).toEqual({
      food: undefined,
      id: 1,
    });
    expect(denormalize(2, menuSchema, entities)).toBeUndefined();
  });

  test('can denormalize already partially denormalized data', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema,
    });

    const entities = {
      menus: {
        1: { id: 1, food: { id: 1 } },
      },
      foods: {
        1: { id: 1 },
      },
    };

    expect(denormalize(1, menuSchema, entities)).toEqual({
      food: { id: 1 },
      id: 1,
    });
  });

  test('denormalizes recursive dependencies', () => {
    const user = new schema.Entity('users');
    const report = new schema.Entity('reports');

    user.define({
      reports: [report],
    });
    report.define({
      draftedBy: user,
      publishedBy: user,
    });

    const entities = {
      reports: {
        123: {
          id: '123',
          title: 'Weekly report',
          draftedBy: '456',
          publishedBy: '456',
        },
      },
      users: {
        456: {
          id: '456',
          role: 'manager',
          reports: ['123'],
        },
      },
    };

    const denormalizedReport = denormalize('123', report, entities) as {
      id: string;
      title: string;
      draftedBy: { id: string; role: string; reports: unknown[] };
      publishedBy: unknown;
    };
    expect(denormalizedReport.id).toBe('123');
    expect(denormalizedReport.title).toBe('Weekly report');
    expect(denormalizedReport.draftedBy.id).toBe('456');
    expect(denormalizedReport.draftedBy.role).toBe('manager');
    expect(denormalizedReport.draftedBy.reports[0]).toBe(denormalizedReport);
    expect(denormalizedReport.publishedBy).toBe(denormalizedReport.draftedBy);

    const denormalizedUser = denormalize('456', user, entities) as {
      id: string;
      role: string;
      reports: Array<{ id: string; title: string; draftedBy: unknown; publishedBy: unknown }>;
    };
    expect(denormalizedUser.id).toBe('456');
    expect(denormalizedUser.role).toBe('manager');
    expect(denormalizedUser.reports[0].id).toBe('123');
    expect(denormalizedUser.reports[0].title).toBe('Weekly report');
    expect(denormalizedUser.reports[0].draftedBy).toBe(denormalizedUser);
    expect(denormalizedUser.reports[0].publishedBy).toBe(denormalizedUser);
  });

  test('denormalizes entities with referential equality', () => {
    const user = new schema.Entity('users');
    const report = new schema.Entity('reports');

    user.define({
      reports: [report],
    });
    report.define({
      draftedBy: user,
      publishedBy: user,
    });

    const entities = {
      reports: {
        123: {
          id: '123',
          title: 'Weekly report',
          draftedBy: '456',
          publishedBy: '456',
        },
      },
      users: {
        456: {
          id: '456',
          role: 'manager',
          reports: ['123'],
        },
      },
    };

    const denormalizedReport = denormalize('123', report, entities) as {
      draftedBy: { reports: unknown[] };
      publishedBy: unknown;
    };

    expect(denormalizedReport).toBe(denormalizedReport.draftedBy.reports[0]);
    expect(denormalizedReport.publishedBy).toBe(denormalizedReport.draftedBy);
  });

  test('denormalizes with fallback strategy', () => {
    const user = new schema.Entity(
      'users',
      {},
      {
        idAttribute: 'userId',
        fallbackStrategy: (id, entitySchema) => ({
          [entitySchema.idAttribute as string]: id,
          name: 'John Doe',
        }),
      },
    );
    const report = new schema.Entity('reports', {
      draftedBy: user,
      publishedBy: user,
    });

    const entities = {
      reports: {
        123: {
          id: '123',
          title: 'Weekly report',
          draftedBy: '456',
          publishedBy: '456',
        },
      },
      users: {},
    };

    const denormalizedReport = denormalize('123', report, entities) as {
      draftedBy: { name: string; userId: string };
      publishedBy: { name: string; userId: string };
    };

    expect(denormalizedReport.publishedBy).toBe(denormalizedReport.draftedBy);
    expect(denormalizedReport.publishedBy.name).toBe('John Doe');
    expect(denormalizedReport.publishedBy.userId).toBe('456');
  });
});
