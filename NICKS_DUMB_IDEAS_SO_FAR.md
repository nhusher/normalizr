# Project Priorities & Design Decisions

## Type System Philosophy

1. **`IdType` is intentionally just `string`** - It's a semantic alias for documentation purposes, not a branded/narrowed type. This is fine; it communicates intent without adding friction.

2. **Users shouldn't have to declare normalized structure explicitly** - The third type parameter on `Entity<TKey, TData, TDefinition>` should be inferred from constructor arguments, not require explicit declaration. The library declares the normalized value, not the user.

3. **Inferring full entity types from schemas is not a primary goal** - `InferredEntity` and `NormalizedEntity` are convenience utilities for prototyping. For production use, users should define explicit interfaces for their entity types.

## Type Testing Standards

4. **Types must work in the IDE, not just pass tests** - If the TypeScript language server shows errors, that's a bug, even if vitest tests pass. End-user IDE experience matters.

5. **Avoid deprecated APIs** - `toMatchTypeOf` is deprecated; use `toEqualTypeOf` with exact type matching instead.
