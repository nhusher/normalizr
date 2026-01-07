# Quick Start

Consider a typical blog post. The API response for a single post might look something like this:

```json
{
  "id": "123",
  "author": {
    "id": "1",
    "name": "Paul"
  },
  "title": "My awesome blog post",
  "comments": [
    {
      "id": "324",
      "commenter": {
        "id": "2",
        "name": "Nicole"
      }
    }
  ]
}
```

We have two nested entity types within our `article`: `users` and `comments`. Using various `schema`, we can normalize all three entity types down:

```ts
import { normalize, schema } from 'normalizr';

// Define a users schema
const user = new schema.Entity('users');

// Define your comments schema
const comment = new schema.Entity('comments', {
  commenter: user,
});

// Define your article
const article = new schema.Entity('articles', {
  author: user,
  comments: [comment],
});

const normalizedData = normalize(originalData, article);
```

Now, `normalizedData` will be:

```js
{
  result: "123",
  entities: {
    "articles": {
      "123": {
        id: "123",
        author: "1",
        title: "My awesome blog post",
        comments: [ "324" ]
      }
    },
    "users": {
      "1": { "id": "1", "name": "Paul" },
      "2": { "id": "2", "name": "Nicole" }
    },
    "comments": {
      "324": { id: "324", "commenter": "2" }
    }
  }
}
```

## TypeScript Usage

Normalizr is written in TypeScript and provides full type inference. You can define your entity types for better type safety:

```ts
import { normalize, denormalize, schema } from 'normalizr';

// Define your data types
interface User {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  commenter: User;
}

interface Article {
  id: string;
  author: User;
  title: string;
  comments: Comment[];
}

// Create schemas with type parameters
const user = new schema.Entity<'users', User>('users');
const comment = new schema.Entity<'comments', Comment>('comments', {
  commenter: user,
});
const article = new schema.Entity<'articles', Article>('articles', {
  author: user,
  comments: [comment],
});

// Normalize data
const { result, entities } = normalize(originalData, article);

// Denormalize back to nested structure
const denormalizedArticle = denormalize(result, article, entities);
```

## Denormalization

To convert normalized data back to its nested form, use `denormalize`:

```ts
import { denormalize, schema } from 'normalizr';

const user = new schema.Entity('users');
const article = new schema.Entity('articles', { author: user });

const entities = {
  articles: {
    '123': { id: '123', title: 'My Article', author: '1' },
  },
  users: {
    '1': { id: '1', name: 'Paul' },
  },
};

const result = denormalize('123', article, entities);
// { id: '123', title: 'My Article', author: { id: '1', name: 'Paul' } }
```

## Circular References

Normalizr handles circular references in your data. For example, a user that has friends who are also users:

```ts
const user = new schema.Entity('users');
user.define({
  friends: [user],
});

const input = {
  id: '1',
  name: 'Alice',
  friends: [
    { id: '2', name: 'Bob', friends: [] },
    { id: '3', name: 'Carol', friends: [] },
  ],
};

const normalized = normalize(input, user);
```

When denormalizing circular references, the same object reference is returned for each occurrence, enabling referential equality checks in your application.
