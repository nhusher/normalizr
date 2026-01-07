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

**Note:** Circular references are not supported when using Immutable.js entities and will throw an error.

### How do I type my normalized data in TypeScript?

Use the exported type utilities:

```ts
import { normalize, schema, Denormalized, EntitiesOf } from 'normalizr';

const userSchema = new schema.Entity('users');
const articleSchema = new schema.Entity('articles', { author: userSchema });

// Get the denormalized type
type Article = Denormalized<typeof articleSchema>;

// Get the entities store type
type Entities = EntitiesOf<typeof articleSchema>;

const { result, entities } = normalize(data, articleSchema);
// entities is typed as Entities
```

### Why are my IDs strings in the entities store?

JavaScript coerces all object keys to strings. Even if your source data has numeric IDs like `{ id: 123 }`, the ID in the entities store will be the string `"123"`. This is standard JavaScript behavior and Normalizr's `IdType` is `string` to reflect this.

### Can I use Normalizr with Immutable.js?

Yes! Normalizr supports denormalizing from Immutable.js data structures:

```ts
import { fromJS } from 'immutable';
import { denormalize, schema } from 'normalizr';

const entities = fromJS({
  users: { '1': { id: '1', name: 'Dan' } },
});

const user = new schema.Entity('users');
const result = denormalize('1', user, entities);
```

Note that circular references are not supported with Immutable.js.

### How do I normalize data with dynamic schemas?

Use a function instead of a schema in your entity definition. The function receives the parent entity and returns the appropriate schema based on its data. See the [Dynamic Schema Functions](./api.md#dynamic-schema-functions) section in the API reference for a complete example.
