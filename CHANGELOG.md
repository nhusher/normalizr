# Changelog

## v4.0.0

Complete TypeScript rewrite with improved type inference and modern tooling.

### Breaking Changes

- **TypeScript rewrite**: The entire library has been rewritten in TypeScript. While the API remains backward compatible, some edge cases may behave differently.
- **IdType is now `string`**: Entity IDs are always strings in the normalized store (JavaScript coerces object keys to strings). If your code relied on numeric IDs in the entities store, you may need to update it.
- **Immutable.js circular references**: Circular references with Immutable.js data structures now throw an error instead of silently producing incorrect results.

### Added

- **Full TypeScript support**: All source code is now TypeScript with comprehensive type definitions.
- **Type inference utilities**: New `Denormalized<S>`, `Normalized<S>`, and `EntitiesOf<S>` types for inferring types from schemas.
- **`validate()` method on Entity**: Override to implement custom input validation during normalization.
- **Lazy denormalization hook**: The `denormalize()` function now accepts a `createUnvisit` option for implementing custom lazy/proxy-based denormalization.
- **Better error messages**: More descriptive errors for invalid inputs and circular reference issues.

### Changed

- **Build system**: Migrated from Rollup to Vite for faster builds and better ESM support.
- **Test runner**: Migrated from Jest to Vitest.
- **Module format**: Now ships as ES modules with CommonJS fallback.

### Removed

- **Flow types**: Flow type definitions have been removed in favor of TypeScript.
- **Old TypeScript definitions**: The hand-written `index.d.ts` has been replaced with generated definitions.

---

For changes prior to v4.0.0, see the [v3.x changelog](https://github.com/paularmstrong/normalizr/blob/master/CHANGELOG.md) in the original repository.
