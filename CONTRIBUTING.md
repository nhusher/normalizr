# Contributing

## Issues

1. Provide a clear description of the problem or feature request.
2. Include a minimal, reproducible test-case when reporting bugs.
3. For usage questions, consider using [StackOverflow](http://stackoverflow.com/questions/tagged/normalizr).

## Pull Requests

Thank you for contributing to Normalizr!

Before submitting a PR, please ensure:

- [ ] Tests are added or updated for your changes
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Code is formatted consistently (`npm run lint`)
- [ ] Relevant documentation is updated

## Setup

```sh
npm install
```

## Running Tests

Run tests:

```sh
npm test
```

Run tests with coverage report:

```sh
npm run test:coverage
```

## Type Checking

Normalizr is written in TypeScript. Ensure your changes compile:

```sh
npm run typecheck
```

## Formatting

Prettier is used to format code:

```sh
npm run format
```

Check formatting without making changes:

```sh
npm run format:check
```

## Lint

ESLint is used for code quality checks:

```sh
npm run lint
```

## Building

Build the library for distribution:

```sh
npm run build
```

This produces ESM and CommonJS bundles in the `dist/` directory, along with TypeScript declaration files.
