# Dealing with Relationships

Occasionally, it is useful to have all one-to-one, one-to-many, and many-to-many relationship data on entities. Normalizr does not handle this automatically, but this example shows a simple way of adding relationship handling using `processStrategy` and `mergeStrategy`.

## Running

```sh
# from the root directory:
npm install

# from this directory:
npx tsx index.ts
```

## How It Works

The key techniques demonstrated:

1. **`processStrategy`**: When normalizing, adds reverse relationship IDs to entities. For example, when a user appears as an author, we add the post's ID to `user.posts`.

2. **`mergeStrategy`**: When the same entity appears multiple times (e.g., same user is author of multiple posts), the merge strategy combines the relationship arrays.

## Files

- [index.ts](./index.ts): Normalizes the input data and writes the output.
- [input.json](./input.json): The raw JSON data before normalization.
- [output.json](./output.json): The normalized output with relationship tracking.
- [schema.ts](./schema.ts): The schema with custom process and merge strategies.
