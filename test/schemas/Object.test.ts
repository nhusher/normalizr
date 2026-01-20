import { describe, test, expect } from 'vitest';
import { denormalize, normalize, schema } from '../../src/index.js';

describe(`${schema.Object.name} normalization`, () => {
  test('normalizes an object', () => {
    const userSchema = new schema.Entity('user');
    const object = new schema.Object({
      user: userSchema,
    });
    expect(normalize({ user: { id: 1 } }, object)).toEqual({
      entities: {
        user: {
          1: { id: 1 },
        },
      },
      result: {
        user: 1,
      },
    });
  });

  test(`normalizes plain objects as shorthand for ${schema.Object.name}`, () => {
    const userSchema = new schema.Entity('user');
    expect(normalize({ user: { id: 1 } }, { user: userSchema })).toEqual({
      entities: {
        user: {
          1: { id: 1 },
        },
      },
      result: {
        user: 1,
      },
    });
  });

  test('filters out undefined and null values', () => {
    const userSchema = new schema.Entity('user');
    const users = { foo: userSchema, bar: userSchema, baz: userSchema };
    expect(normalize({ foo: {}, bar: { id: '1' } } as any, users)).toEqual({
      entities: {
        user: {
          1: { id: '1' },
          undefined: {},
        },
      },
      result: {
        bar: '1',
      },
    });
  });
});

describe(`${schema.Object.name} denormalization`, () => {
  test('denormalizes an object', () => {
    const userSchema = new schema.Entity('user');
    const object = new schema.Object({
      user: userSchema,
    });
    const entities = {
      user: {
        1: { id: 1, name: 'Nacho' },
      },
    };
    expect(denormalize({ user: 1 }, object, entities)).toEqual({
      user: {
        id: 1,
        name: 'Nacho',
      },
    });
  });

  test('denormalizes plain object shorthand', () => {
    const userSchema = new schema.Entity('user');
    const entities = {
      user: {
        1: { id: 1, name: 'Jane' },
      },
    };
    expect(denormalize({ user: 1 } as any, { user: userSchema, tacos: {} }, entities)).toEqual({
      user: {
        id: 1,
        name: 'Jane',
      },
    });
  });

  test('denormalizes an object that contains a property representing a an object with an id of zero', () => {
    const userSchema = new schema.Entity('user');
    const object = new schema.Object({
      user: userSchema,
    });
    const entities = {
      user: {
        0: { id: 0, name: 'Chancho' },
      },
    };
    expect(denormalize({ user: 0 }, object, entities)).toEqual({
      user: {
        id: 0,
        name: 'Chancho',
      },
    });
  });
});
