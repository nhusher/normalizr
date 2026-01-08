import { writeFileSync, readFileSync } from 'fs';
import { normalize } from '../../src/index.js';
import { resolve } from 'path';
import postsSchema, { PostInput } from './schema.js';

const inputPath = resolve(import.meta.dirname, './input.json');
const input: PostInput[] = JSON.parse(readFileSync(inputPath, 'utf-8'));

const normalizedData = normalize(input, postsSchema);
const output = JSON.stringify(normalizedData, null, 2);

const outputPath = resolve(import.meta.dirname, './output.json');
writeFileSync(outputPath, output);

console.log('Normalized data written to output.json');
console.log('\nEntities created:');
console.log(`  - ${Object.keys(normalizedData.entities.posts || {}).length} posts`);
console.log(`  - ${Object.keys(normalizedData.entities.comments || {}).length} comments`);
console.log(`  - ${Object.keys(normalizedData.entities.users || {}).length} users`);

// Show how users now have reverse relationships
console.log('\nUsers with relationship tracking:');
for (const [id, user] of Object.entries(normalizedData.entities.users || {})) {
  const u = user as { name: string; posts?: string[]; comments?: string[] };
  console.log(`  - ${u.name} (id: ${id})`);
  if (u.posts?.length) console.log(`      authored posts: ${u.posts.join(', ')}`);
  if (u.comments?.length) console.log(`      made comments: ${u.comments.join(', ')}`);
}
