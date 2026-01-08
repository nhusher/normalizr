# Normalizing GitHub Issues

This is a barebones example for Node.js to illustrate how normalizing the GitHub Issues API endpoint could work.

## Running

```sh
# from the root directory:
npm install

# from this directory:
npx tsx index.ts
```

## Files

- [index.ts](./index.ts): Fetches live data from the GitHub API for this project's issues and normalizes the JSON.
- [output.json](./output.json): A sample of the normalized output.
- [schema.ts](./schema.ts): The schema used to normalize the GitHub issues.
