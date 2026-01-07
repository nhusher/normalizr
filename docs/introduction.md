# Introduction

## Motivation

Many APIs, public or not, return JSON data that has deeply nested objects. Using data in this kind of structure is often very difficult for JavaScript applications, especially those using [Flux](http://facebook.github.io/flux/) or [Redux](http://redux.js.org/).

## Solution

Normalizr is a small, but powerful utility for taking JSON with a schema definition and returning nested entities with their IDs, gathered in dictionaries.

### Example

The following nested object:

```js
[
  {
    id: 1,
    title: 'Some Article',
    author: {
      id: 1,
      name: 'Dan',
    },
  },
  {
    id: 2,
    title: 'Other Article',
    author: {
      id: 1,
      name: 'Dan',
    },
  },
];
```

Can be normalized to:

```js
{
  result: [1, 2],
  entities: {
    articles: {
      1: {
        id: 1,
        title: 'Some Article',
        author: 1
      },
      2: {
        id: 2,
        title: 'Other Article',
        author: 1
      }
    },
    users: {
      1: {
        id: 1,
        name: 'Dan'
      }
    }
  }
}
```

## Build Files

Normalizr ships with two module formats:

- **ESM** (`dist/normalizr.js`) - ES Modules format, suitable for modern bundlers like Vite, webpack, Rollup, or esbuild. This is the default when using `import`.
- **CommonJS** (`dist/normalizr.cjs`) - CommonJS format for Node.js and older bundlers. This is the default when using `require()`.

TypeScript declaration files (`dist/index.d.ts`) are included for full type support.

### Package Exports

The `package.json` uses the `exports` field to automatically provide the correct format:

```js
// ESM (recommended)
import { normalize, schema } from 'normalizr';

// CommonJS
const { normalize, schema } = require('normalizr');
```

### Browser Usage

While you can technically load Normalizr directly in a browser via a CDN, it's recommended to use a bundler like [Vite](https://vitejs.dev/), [webpack](https://webpack.js.org/), or [esbuild](https://esbuild.github.io/) for production applications.
