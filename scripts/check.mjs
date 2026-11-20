import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { BED, RIM, TRAY, HOME_PITCH, MIN_PITCH, MAX_PITCH, orthographic } from '../assets/geometry.js';
import { pricingDocuments } from './pricing-api.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const [atlas, logos, logoFiles, brandColors] = await Promise.all([
  readJson('data/atlas.json'),
  readJson('assets/logos/manifest.json'),
  readdir(new URL('assets/logos/', root)),
  readJson('assets/brand-colors.json')
]);

const kinds = new Set(['launch', 'feature', 'funding', 'adoption', 'partnership', 'retirement']);
const categories = new Set(['Sandboxes', 'Cloud platforms', 'Developer tools']);
const foundersAndFacts = ['founded', 'funding', 'revenue', 'valuation'];
const sourceLists = ['products', 'strengths', 'tradeoffs', 'founders', 'investors'];
const sourceCoverage = [
  'e2b', 'vercel', 'cloudflare', 'modal', 'daytona', 'sprites', 'freestyle', 'microsandbox',
  'runloop', 'morph', 'blaxel', 'together', 'northflank', 'riza', 'deno', 'aws', 'azure', 'openai',
  'instabox', 'proton', 'docker', 'upstash', 'tensorlake', 'koyeb', 'namespace', 'beam', 'machine0',
  'boat', 'pine', 'instavm', 'celesto', 'prized', 'agent37', 'superserve', 'digitalocean', 'maritime',
  'depot', 'blacksmith', 'openscale', 'agentcomputer', 'buddy', 'mosaic', 'codesandbox', 'novita', 'google'
];

const text = value => typeof value === 'string' && value.trim().length > 0;
const https = value => text(value) && new URL(value).protocol === 'https:';
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const providers = new Set();
const eventKeys = new Set();

assert(date(atlas.asOf), 'Invalid snapshot date');
for (const p of atlas.companies) {
  assert(/^[a-z0-9-]+$/.test(p.id) && !providers.has(p.id), 'Duplicate or invalid provider ID: ' + p.id);
  providers.add(p.id);
  assert([p.name, p.provider, p.description].every(text) && categories.has(p.category), 'Incomplete profile: ' + p.id);
  assert(foundersAndFacts.every(key => p[key] === null || text(p[key])), 'Invalid company facts: ' + p.id);
  assert(sourceLists.every(key => Array.isArray(p[key]) && p[key].every(text)), 'Invalid profile details: ' + p.id);
  assert(p.sources?.length && p.sources.every(source => text(source.label) && https(source.url)), 'Missing or invalid sources: ' + p.id);
  assert(p.pricing?.length && p.pricing.every(price => text(price.label) && text(price.value) && typeof price.detail === 'string'), 'Invalid pricing: ' + p.id);
  const brand = brandColors[p.id];
  assert(Array.isArray(brand) && brand.length === 3 && brand.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255), 'Missing or invalid brand color: ' + p.id);
  const logo = logos[p.id];
  assert(logo && logo.file === p.id + '.png' && logoFiles.includes(logo.file) && https(logo.source), 'Missing or invalid logo: ' + p.id);
  const bytes = await readFile(new URL('assets/logos/' + logo.file, root));
  assert(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid PNG: ' + logo.file);
}
assert(sourceCoverage.every(id => providers.has(id)), 'A provider from the reference images is missing');
assert.equal(Object.keys(logos).length, providers.size, 'Logo manifest must match the catalog');

for (const event of atlas.events) {
  const key = [event.company, event.date, event.title.toLowerCase()].join('|');
  assert(!eventKeys.has(key), 'Duplicate event: ' + key);
  eventKeys.add(key);
  assert(providers.has(event.company) && kinds.has(event.kind), 'Invalid event provider or type: ' + key);
  assert(date(event.date) && event.date <= atlas.asOf, 'Invalid event date: ' + key);
  assert([event.title, event.summary, event.source].every(text) && https(event.url), 'Invalid event evidence: ' + key);
  if (event.tweetUrl) assert(https(event.tweetUrl), 'Invalid original post link: ' + key);
  if (event.relatedCompany) assert(providers.has(event.relatedCompany) && event.relatedCompany !== event.company, 'Invalid shared rollout: ' + key);
}
console.log(atlas.companies.length + ' provider profiles and logos, ' + atlas.events.length + ' sourced signals, all 45 reference offerings.');

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, actual + ' differs from ' + expected);
for (let i = 0; i < RIM.length; i++) {
  const [x, y] = RIM[i];
  const [bx, by] = RIM[(i + 1) % RIM.length];
  const [ix, iy] = BED[i];
  const length = Math.hypot(bx - x, by - y);
  near(length, TRAY.radius);
  near(Math.abs((bx - x) * (iy - y) - (by - y) * (ix - x)) / length, TRAY.wall);
}

for (const pitch of [MIN_PITCH, HOME_PITCH, MAX_PITCH]) {
  for (let step = 0; step < 24; step++) {
    const yaw = step * Math.PI / 12;
    const {project, unproject} = orthographic(yaw, pitch);
    for (const [x, y] of RIM) {
      const floor = project(x, y, TRAY.floor);
      const lip = project(x, y, TRAY.lip);
      near(floor.x, lip.x);
      near(floor.y - lip.y, (TRAY.lip - TRAY.floor) * Math.cos(pitch));
      const right = project(x + 15 * Math.cos(yaw), y - 15 * Math.sin(yaw), TRAY.floor);
      const forward = project(x + 15 * Math.sin(yaw), y + 15 * Math.cos(yaw), TRAY.floor);
      near(right.x - floor.x, 15);
      near(right.y, floor.y);
      near(forward.x, floor.x);
      near(forward.y - floor.y, 15 * Math.sin(pitch));
      const fromScreen = unproject(lip.x, lip.y, TRAY.lip);
      near(fromScreen.x, x);
      near(fromScreen.y, y);
    }
  }
}
console.log('Regular tray, uniform wall thickness and orthographic projection verified at 72 camera angles.');

const api = await pricingDocuments();
const catalog = api.get('catalog.json');
const prices = catalog.offerings.flatMap(offering => offering.pricing);
console.log(catalog.offerings.length + ' API offerings, ' + prices.length + ' price entries, ' + prices.reduce((count,price) => count+price.charges.length,0) + ' structured charges.');
