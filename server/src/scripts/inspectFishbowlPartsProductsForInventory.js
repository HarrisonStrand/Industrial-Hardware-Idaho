import '../config/env.js';
import { fishbowlClient } from '../integrations/fishbowl/fishbowlClient.js';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function extractResults(data) {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  for (const key of ['results', 'data', 'items', 'parts', 'products', 'rows']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function findInventoryishValues(obj, base = '', out = []) {
  if (!obj || typeof obj !== 'object') return out;

  if (Array.isArray(obj)) {
    obj.slice(0, 3).forEach((item, i) => findInventoryishValues(item, `${base}[${i}]`, out));
    return out;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = base ? `${base}.${key}` : key;
    const keyLooksUseful = /(qty|quantity|available|onhand|on_hand|on hand|allocated|committed|onorder|on_order|on order|inventory|stock)/i.test(key);

    if (keyLooksUseful && (typeof value === 'number' || typeof value === 'string' || value == null)) {
      out.push({ path, value });
    }

    if (value && typeof value === 'object') {
      findInventoryishValues(value, path, out);
    }
  }

  return out;
}

function describeResponse(resp) {
  return {
    ok: !!resp?.ok,
    status: resp?.status,
    dataType: Array.isArray(resp?.data) ? 'array' : typeof resp?.data,
    keys: isObject(resp?.data) ? Object.keys(resp.data) : [],
    body: typeof resp?.data === 'string' ? resp.data.slice(0, 1000) : resp?.data,
  };
}

async function requestPath(path) {
  return fishbowlClient.request({ method: 'GET', path });
}

async function main() {
  const pageNumber = Number(process.argv.find((arg) => arg.startsWith('--page='))?.split('=')[1] || 1);
  const pageSize = Number(process.argv.find((arg) => arg.startsWith('--size='))?.split('=')[1] || 10);
  const part = process.argv.find((arg) => arg.startsWith('--part='))?.split('=')[1] || '';

  const endpoints = [
    '/api/parts',
    `/api/parts?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    '/api/products',
    `/api/products?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  ];

  console.log('🔎 Inspecting Fishbowl parts/products with and without pagination...');

  for (const path of endpoints) {
    const resp = await requestPath(path);
    console.log(`\n===== ${path} =====`);
    console.log(JSON.stringify(describeResponse(resp), null, 2).slice(0, 2500));

    if (!resp.ok) continue;

    const rows = extractResults(resp.data);
    console.log(`rows: ${rows.length}`);
    if (!rows.length) continue;

    const filteredRows = part
      ? rows.filter((row) => {
          const text = [row.number, row.partNumber, row.num, row.sku, row.description, row.name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return text.includes(part.toLowerCase());
        })
      : rows.slice(0, 5);

    const samples = filteredRows.length ? filteredRows.slice(0, 5) : rows.slice(0, 5);

    for (const [index, row] of samples.entries()) {
      const keys = Object.keys(row || {});
      const inventoryish = findInventoryishValues(row).slice(0, 80);
      console.log(`\n--- sample ${index + 1} keys ---`);
      console.log(keys);
      console.log('inventory-like fields:');
      console.log(JSON.stringify(inventoryish, null, 2));
      console.log('row sample:');
      console.log(JSON.stringify(row, null, 2).slice(0, 5000));
    }
  }
}

main().catch((err) => {
  console.error('❌ Inspect failed:', err);
  process.exit(1);
});
