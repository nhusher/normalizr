/**
 * Check if an object has a property as its own (not inherited from prototype).
 *
 * This is a safe alternative to `in` operator or direct property access,
 * which can return prototype properties like `constructor`, `__proto__`, etc.
 *
 * Uses the native `Object.hasOwn` (ES2022) if available, otherwise falls back
 * to `Object.prototype.hasOwnProperty.call`.
 *
 * @param obj - The object to check
 * @param key - The property key to check for
 * @returns True if the object has the property as its own property
 */
export const hasOwn: (obj: object, key: PropertyKey) => boolean =
  // @ts-expect-error - Object.hasOwn is not available in all environments
  Object.hasOwn ?? ((obj, key) => Object.prototype.hasOwnProperty.call(obj, key));
