import { describe, test, expect } from 'vitest';
import { denormalize, normalize, schema } from '../../src/index.js';

describe(`${schema.Union.name} normalization`, () => {
  test('throws if not given a schemaAttribute', () => {
    // @ts-expect-error - testing runtime error
    expect(() => new schema.Union({})).toThrow();
  });

  test('normalizes an object using string schemaAttribute', () => {
    const user = new schema.Entity('users');
    const group = new schema.Entity('groups');
    const union = new schema.Union(
      {
        users: user,
        groups: group,
      },
      'type',
    );

    expect(normalize({ id: 1, type: 'users' }, union)).toEqual({
      entities: {
        users: {
          1: { id: 1, type: 'users' },
        },
      },
      result: {
        id: 1,
        schema: 'users',
      },
    });
    expect(normalize({ id: 2, type: 'groups' }, union)).toEqual({
      entities: {
        groups: {
          2: { id: 2, type: 'groups' },
        },
      },
      result: {
        id: 2,
        schema: 'groups',
      },
    });
  });

  test('normalizes an array of multiple entities using a function to infer the schemaAttribute', () => {
    const user = new schema.Entity('users');
    const group = new schema.Entity('groups');
    const union = new schema.Union(
      {
        users: user,
        groups: group,
      },
      (input: unknown) => {
        const obj = input as { username?: string; groupname?: string };
        return obj.username ? 'users' : obj.groupname ? 'groups' : '';
      },
    );

    expect(normalize({ id: 1, username: 'Janey' }, union)).toEqual({
      entities: {
        users: {
          1: { id: 1, username: 'Janey' },
        },
      },
      result: {
        id: 1,
        schema: 'users',
      },
    });
    expect(normalize({ id: 2, groupname: 'People' }, union)).toEqual({
      entities: {
        groups: {
          2: { groupname: 'People', id: 2 },
        },
      },
      result: {
        id: 2,
        schema: 'groups',
      },
    });
    expect(normalize({ id: 3, notdefined: 'yep' }, union)).toEqual({
      entities: {},
      result: {
        id: 3,
        notdefined: 'yep',
      },
    });
  });
});

describe(`${schema.Union.name} denormalization`, () => {
  const user = new schema.Entity('users');
  const group = new schema.Entity('groups');
  const entities = {
    users: {
      1: { id: 1, username: 'Janey', type: 'users' },
    },
    groups: {
      2: { id: 2, groupname: 'People', type: 'groups' },
    },
  };

  test('denormalizes an object using string schemaAttribute', () => {
    const union = new schema.Union(
      {
        users: user,
        groups: group,
      },
      'type',
    );

    expect(denormalize({ id: 1, schema: 'users' }, union, entities)).toEqual({
      id: 1,
      type: 'users',
      username: 'Janey',
    });
    expect(denormalize({ id: 2, schema: 'groups' }, union, entities)).toEqual({
      groupname: 'People',
      id: 2,
      type: 'groups',
    });
  });

  test('denormalizes an array of multiple entities using a function to infer the schemaAttribute', () => {
    const union = new schema.Union(
      {
        users: user,
        groups: group,
      },
      (input: unknown) => {
        return (input as { username?: string }).username ? 'users' : 'groups';
      },
    );

    expect(denormalize({ id: 1, schema: 'users' }, union, entities)).toEqual({
      id: 1,
      type: 'users',
      username: 'Janey',
    });
    expect(denormalize({ id: 2, schema: 'groups' }, union, entities)).toEqual({
      groupname: 'People',
      id: 2,
      type: 'groups',
    });
  });

  test('returns the original value no schema is given', () => {
    const union = new schema.Union(
      {
        users: user,
        groups: group,
      },
      (input: unknown) => {
        return (input as { username?: string }).username ? 'users' : 'groups';
      },
    );

    expect(denormalize({ id: 1 }, union, entities)).toEqual({
      id: 1,
    });
  });
});
