import * as schemaDefinitions from './schema.js';
import { writeFileSync } from 'fs';
import { normalize } from '../../src/index.js';
import { resolve } from 'path';

const REPO = 'automerge/automerge';

async function main() {
  console.log(`Fetching issues from ${REPO}...`);

  const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    headers: {
      'User-Agent': 'normalizr-example',
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const normalizedData = normalize(data, schemaDefinitions.issueOrPullRequest);

  const output = JSON.stringify(normalizedData, null, 2);
  const outputPath = resolve(import.meta.dirname, './output.json');

  writeFileSync(outputPath, output);
  console.log(`Normalized data written to ${outputPath}`);
  console.log(`Found ${Object.keys(normalizedData.entities.issues || {}).length} issues`);
  console.log(`Found ${Object.keys(normalizedData.entities.pullRequests || {}).length} pull requests`);
  console.log(`Found ${Object.keys(normalizedData.entities.users || {}).length} unique users`);
}

main().catch(console.error);
