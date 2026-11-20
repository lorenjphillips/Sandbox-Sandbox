import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pricingDocuments } from './pricing-api.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const publicFiles = ['index.html', 'assets', 'data/atlas.json'];
const api = await pricingDocuments();

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map(file => cp(new URL(file, root), new URL(file, output), {
  recursive: true,
  filter: source => !basename(source).startsWith('.')
})));
const apiRoot = new URL('api/v1/', output);
await mkdir(new URL('providers/', apiRoot), { recursive: true });
await Promise.all([...api].map(([path,document]) => writeFile(new URL(path, apiRoot), JSON.stringify(document) + '\n')));
await writeFile(new URL('_headers', output), '/api/v1/*\n  Access-Control-Allow-Origin: *\n  Access-Control-Expose-Headers: ETag\n  X-Content-Type-Options: nosniff\n  Link: <https://sandboxsandbox.org/api/v1/openapi.json>; rel="service-desc"\n');
