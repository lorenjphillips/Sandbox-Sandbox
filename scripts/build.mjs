import { cp, mkdir, rm } from 'node:fs/promises';
import { basename } from 'node:path';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const publicFiles = ['index.html', 'assets', 'data'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map(file => cp(new URL(file, root), new URL(file, output), {
  recursive: true,
  filter: source => !basename(source).startsWith('.')
})));
