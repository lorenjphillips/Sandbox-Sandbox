import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const origin = 'https://sandboxsandbox.org';
const statuses = ['published', 'free', 'included', 'quote', 'historical', 'unverified'];
const notes = [
  'Prices are public snapshot data. The value and detail fields preserve the catalog wording.',
  'Use charges for directly comparable rates. Compare meter, billing unit, currency, usage basis, and hardware or region, and account for plan minimums and included usage.',
  'An empty charges array means no separately modeled numeric rate. Null verifiedAt means a rate-specific verification date is unavailable.',
  'Published, free, and included entries have different billing conditions. Historical, custom quote, and unverified entries should not be used as current cost estimates.'
];

const string = { type: 'string' };
const date = { type: 'string', format: 'date' };
const uri = { type: 'string', format: 'uri' };
const number = { type: 'number', minimum: 0 };
const list = items => ({ type: 'array', items });
const record = (properties, required=Object.keys(properties)) => ({ type: 'object', properties, required });
const ref = name => ({ $ref: '#/components/schemas/' + name });
const representation = schema => ({ description: 'OK', content: { 'application/json': { schema: ref(schema) } } });
const metadata = { schemaVersion: { type: 'integer', const: 1 }, asOf: date };

function apiDescription() {
  return {
    openapi: '3.1.0',
    info: { title: 'Sandbox Sandbox pricing API', version: '1.0.0', description: notes.join(' ') },
    servers: [{ url: origin }],
    paths: {
      '/api/v1/catalog.json': {
        get: { operationId: 'getCatalog', summary: 'Get all sandbox offerings and pricing', responses: { 200: representation('Catalog') } }
      },
      '/api/v1/providers/{id}.json': {
        get: {
          operationId: 'getOffering', summary: 'Get a sandbox offering by ID',
          parameters: [{ name: 'id', in: 'path', required: true, description: 'Offering ID from the catalog.', schema: string, example: 'e2b' }],
          responses: { 200: representation('OfferingSnapshot'), 404: { description: 'Unknown offering ID' } }
        }
      }
    },
    components: { schemas: {
      Catalog: record({ ...metadata, notes: list(string), offerings: list(ref('Offering')) }),
      OfferingSnapshot: record({ ...metadata, offering: ref('Offering') }),
      Offering: record({
        id: string, name: string, provider: string, category: string, status: string, description: string, endpoint: uri,
        products: list(string), strengths: list(string), tradeoffs: list(string), pricing: list(ref('Price')),
        sources: list(record({ label: string, url: uri }))
      }),
      Price: record({
        label: string, value: string, detail: string, status: { type: 'string', enum: statuses },
        sourceUrl: { anyOf: [uri,{ type: 'null' }] }, verifiedAt: { anyOf: [date,{ type: 'null' }] }, charges: list(ref('Charge'))
      }),
      Charge: {
        ...record({
          meter: string, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, unit: string,
          amount: number, minAmount: number, maxAmount: number, basis: string, region: string, variant: string, minimum: { type: 'boolean' }
        }, ['meter','currency','unit']),
        oneOf: [{ required: ['amount'], not: { anyOf: [{ required: ['minAmount'] },{ required: ['maxAmount'] }] } },{ required: ['minAmount'], not: { required: ['amount'] } }]
      }
    } }
  };
}

function checkCharge(charge, key) {
  const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value);
  const nonnegative = value => Number.isFinite(value) && value >= 0;
  assert(identifier(charge.meter) && identifier(charge.unit) && typeof charge.currency === 'string' && /^[A-Z]{3}$/.test(charge.currency), 'Invalid rate unit or currency: ' + key);
  assert(charge.amount !== undefined ?
    nonnegative(charge.amount) && charge.minAmount === undefined && charge.maxAmount === undefined :
    nonnegative(charge.minAmount) && (charge.maxAmount === undefined || nonnegative(charge.maxAmount) && charge.maxAmount >= charge.minAmount),
  'Invalid rate or range: ' + key);
  for(const field of ['basis','region','variant']) {
    assert(charge[field] === undefined || typeof charge[field] === 'string' && charge[field].trim(), 'Invalid rate condition: ' + key);
  }
  assert(charge.minimum === undefined || typeof charge.minimum === 'boolean', 'Invalid minimum: ' + key);
}

export async function pricingDocuments() {
  const [atlas, first, second] = await Promise.all(['atlas.json','rates-a.json','rates-b.json'].map(async file =>
    JSON.parse(await readFile(new URL('data/' + file, root), 'utf8'))
  ));
  const normalization = new Map([...Object.entries(first),...Object.entries(second)]);
  assert.equal(normalization.size,Object.keys(first).length+Object.keys(second).length,'Duplicate normalized offering');
  assert.equal(normalization.size,atlas.companies.length,'Offerings must match normalization');
  const offerings = atlas.companies.map(company => {
    const { id, name, provider, category, description, products, strengths, tradeoffs, sources } = company;
    const rates = normalization.get(id);
    assert.equal(rates?.length,company.pricing.length,'Price rows must match for ' + id);
    const pricing = company.pricing.map((quote,index) => {
      const rate = rates[index];
      const key = id + ' / ' + quote.label;
      assert.equal(rate.label,quote.label,'Rate label must match for ' + key);
      assert(statuses.includes(rate.status),'Invalid rate status: ' + key);
      assert(rate.sourceUrl === null || new URL(rate.sourceUrl).protocol === 'https:', 'Invalid rate source: ' + key);
      assert(rate.verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(rate.verifiedAt) &&
        new Date(rate.verifiedAt+'T00:00:00Z').toISOString().slice(0,10) === rate.verifiedAt && rate.verifiedAt <= atlas.asOf,
      'Invalid rate verification date: ' + key);
      assert(Array.isArray(rate.charges),'Missing rate charges: ' + key);
      rate.charges.forEach(charge => checkCharge(charge,key));
      const { status,sourceUrl,verifiedAt,charges } = rate;
      return { ...quote,status,sourceUrl,verifiedAt,charges };
    });
    return { id, name, provider, category, status: company.status || 'Available', description,
      endpoint: `${origin}/api/v1/providers/${id}.json`, products, strengths, tradeoffs, pricing, sources };
  });
  const snapshot = { schemaVersion: 1, asOf: atlas.asOf };
  return new Map([
    ['catalog.json',{ ...snapshot, notes, offerings }],
    ['openapi.json',apiDescription()],
    ...offerings.map(offering => [`providers/${offering.id}.json`,{ ...snapshot, offering }])
  ]);
}
