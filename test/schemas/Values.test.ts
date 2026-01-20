import { describe, test, expect } from 'vitest';
import { denormalize, normalize, schema } from '../../src/index.js';

describe(`${schema.Values.name} normalization`, () => {
  test('normalizes the values of an object with the given schema', () => {
    const cat = new schema.Entity('cats');
    const dog = new schema.Entity('dogs');
    const valuesSchema = new schema.Values(
      {
        dogs: dog,
        cats: cat,
      },
      (entity: unknown) => (entity as { type: string }).type,
    );

    expect(
      normalize(
        {
          fido: { id: 1, type: 'dogs' },
          fluffy: { id: 1, type: 'cats' },
        },
        valuesSchema,
      ),
    ).toEqual({
      entities: {
        cats: {
          1: { id: 1, type: 'cats' },
        },
        dogs: {
          1: { id: 1, type: 'dogs' },
        },
      },
      result: {
        fido: { id: 1, schema: 'dogs' },
        fluffy: { id: 1, schema: 'cats' },
      },
    });
  });

  test('can use a function to determine the schema when normalizing', () => {
    const cat = new schema.Entity('cats');
    const dog = new schema.Entity('dogs');
    const valuesSchema = new schema.Values(
      {
        dogs: dog,
        cats: cat,
      },
      (entity: unknown) => `${(entity as { type: string }).type}s`,
    );

    expect(
      normalize(
        {
          fido: { id: 1, type: 'dog' },
          fluffy: { id: 1, type: 'cat' },
          jim: { id: 2, type: 'lizard' },
        },
        valuesSchema,
      ),
    ).toEqual({
      entities: {
        cats: {
          1: { id: 1, type: 'cat' },
        },
        dogs: {
          1: { id: 1, type: 'dog' },
        },
      },
      result: {
        fido: { id: 1, schema: 'dogs' },
        fluffy: { id: 1, schema: 'cats' },
        jim: { id: 2, type: 'lizard' },
      },
    });
  });

  test('filters out null and undefined values', () => {
    const cat = new schema.Entity('cats');
    const dog = new schema.Entity('dogs');
    const valuesSchema = new schema.Values(
      {
        dogs: dog,
        cats: cat,
      },
      (entity: unknown) => (entity as { type: string }).type,
    );

    expect(
      normalize(
        {
          fido: undefined,
          milo: null,
          fluffy: { id: 1, type: 'cats' },
        },
        valuesSchema,
      ),
    ).toEqual({
      entities: {
        cats: {
          1: { id: 1, type: 'cats' },
        },
      },
      result: {
        fluffy: { id: 1, schema: 'cats' },
      },
    });
  });
});

describe(`${schema.Values.name} denormalization`, () => {
  test('denormalizes the values of an object with the given schema', () => {
    const cat = new schema.Entity('cats');
    const dog = new schema.Entity('dogs');
    const valuesSchema = new schema.Values(
      {
        dogs: dog,
        cats: cat,
      },
      (entity: unknown) => (entity as { type: string }).type,
    );

    const entities = {
      cats: { 1: { id: 1, type: 'cats' } },
      dogs: { 1: { id: 1, type: 'dogs' } },
    };

    expect(
      denormalize(
        {
          fido: { id: 1, schema: 'dogs' },
          fluffy: { id: 1, schema: 'cats' },
        },
        valuesSchema,
        entities,
      ),
    ).toEqual({
      fido: { id: 1, type: 'dogs' },
      fluffy: { id: 1, type: 'cats' },
    });
  });
});
