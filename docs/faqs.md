# Frequently Asked Questions

### How do I handle circular references?

Normalizr handles circular references automatically. When defining schemas with circular references, use the `define()` method:

```ts
const user = new schema.Entity('users');
const comment = new schema.Entity('comments', { author: user });

// Circular: user has comments, comments have authors (users)
user.define({
  comments: [comment],
});
```

When denormalizing, circular references will maintain referential equality - the same object instance is returned for the same entity ID.

### How do I type my normalized data in TypeScript?

Use the `.as<T>()` method to associate TypeScript interfaces with your schemas, then use the exported type utilities:

```ts
import { normalize, schema, Denormalized, AllEntitiesOf } from 'normalizr';

interface User {
  id: string;
  name: string;
}

interface Article {
  id: string;
  title: string;
  author: User;
}

// Use .as<T>() to associate interfaces with schemas
const userSchema = new schema.Entity('users').as<User>();
const articleSchema = new schema.Entity('articles', {
  author: userSchema,
}).as<Article>();

// Get the denormalized type
type ArticleType = Denormalized<typeof articleSchema>;
// Article

// Get the entities store type (includes all nested entity types)
type Entities = AllEntitiesOf<typeof articleSchema>;
// { users: Record<string, User>; articles: Record<string, Article> }

const { result, entities } = normalize(data, articleSchema);
// entities is typed as Entities
```

### Why should I use `.as<T>()` instead of `new schema.Entity<'key', Type>(...)`?

TypeScript has a [limitation with partial type parameter inference](https://github.com/microsoft/TypeScript/issues/26242). When you provide explicit type parameters like `new schema.Entity<'articles', Article>('articles', { author: userSchema })`, TypeScript uses default values for any parameters you don't specify—including the schema definition type.

This means nested schema types are lost:

```ts
// ❌ TDefinition defaults to {} instead of being inferred
const articleSchema = new schema.Entity<'articles', Article>('articles', {
  author: userSchema,
});

type Entities = AllEntitiesOf<typeof articleSchema>;
// Only { articles: Record<string, Article> } - users is missing!
```

The `.as<T>()` method avoids this by letting TypeScript infer all parameters from constructor arguments first, then narrowing the data type:

```ts
// ✅ Full type inference preserved
const articleSchema = new schema.Entity('articles', {
  author: userSchema,
}).as<Article>();

type Entities = AllEntitiesOf<typeof articleSchema>;
// { articles: Record<string, Article>; users: Record<string, User> }
```

### Why are my IDs strings in the entities store?

JavaScript coerces all object keys to strings. Even if your source data has numeric IDs like `{ id: 123 }`, the ID in the entities store will be the string `"123"`. This is standard JavaScript behavior and Normalizr's `IdType` is `string` to reflect this.

### How do I normalize data with dynamic schemas?

Use a function instead of a schema in your entity definition. The function receives the parent entity and returns the appropriate schema based on its data. See the [Dynamic Schema Functions](./api.md#dynamic-schema-functions) section in the API reference for a complete example.
