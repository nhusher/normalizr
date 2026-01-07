/**
 * Helpers to enable Immutable.js compatibility *without* bringing in
 * the 'immutable' package as a dependency.
 */

import type { Schema, UnvisitFn } from '../types.js';

/**
 * Interface for Immutable.js Map-like objects.
 */
interface ImmutableMapLike {
  get(key: string): unknown;
  set(key: string, value: unknown): ImmutableMapLike;
  has(key: string): boolean;
  hasOwnProperty?: (key: string) => boolean;
  __ownerID?: unknown;
  _map?: { __ownerID?: unknown };
}

/**
 * Check if an object is an Immutable.js data structure.
 *
 * This checks for internal properties specific to Immutable.js without
 * requiring the library as a dependency.
 *
 * @param object - The object to check
 * @returns true if the object is an Immutable.js data structure
 */
export function isImmutable(object: unknown): object is ImmutableMapLike {
  return !!(
    object &&
    typeof object === 'object' &&
    // Cast justified: probing for hasOwnProperty existence on unknown object
    typeof (object as Record<string, unknown>).hasOwnProperty === 'function' &&
    // Cast justified: probing for Immutable.js internal __ownerID property
    // Check for Immutable.Map
    ((object as ImmutableMapLike).__ownerID !== undefined ||
      // Check for Immutable.Record
      ((object as ImmutableMapLike)._map && (object as ImmutableMapLike)._map!.__ownerID !== undefined))
  );
}

/**
 * Denormalize an Immutable.js entity.
 *
 * @param schema - The schema definition for the entity
 * @param input - The Immutable.js Map or Record to denormalize
 * @param unvisit - The unvisit function for recursive denormalization
 * @returns The denormalized Immutable.js data structure
 */
export function denormalizeImmutable(schema: Record<string, Schema>, input: unknown, unvisit: UnvisitFn): unknown {
  // Cast justified: callers only pass Immutable.js objects (guarded by isImmutable check)
  const immutableInput = input as ImmutableMapLike;

  return Object.keys(schema).reduce((object, key) => {
    // Immutable maps cast keys to strings on write so we need to ensure
    // we're accessing them using string keys.
    const stringKey = `${key}`;
    // Cast justified: accumulator maintains ImmutableMapLike type through reduction
    const immutableObject = object as ImmutableMapLike;

    if (immutableObject.has(stringKey)) {
      return immutableObject.set(stringKey, unvisit(immutableObject.get(stringKey), schema[stringKey]));
    } else {
      return object;
    }
  }, immutableInput);
}
