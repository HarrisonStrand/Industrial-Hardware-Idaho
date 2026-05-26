import '../config/env.js';
import mongoose from 'mongoose';

import Product from '../models/Product.js';
import SyncRun from '../models/SyncRun.js';
import { fishbowlClient } from '../integrations/fishbowl/fishbowlClient.js';

function clean(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function getByPath(obj, path) {
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function firstNumberByPaths(obj, paths = []) {
  for (const path of paths) {
    const value = getByPath(obj, path);
    const num = asNumber(value, null);
    if (num !== null) return { path, value: num };
  }
  return null;
}

function findRecursiveNumber(obj, matcher, base = '') {
  if (!obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 25); i += 1) {
      const result = findRecursiveNumber(obj[i], matcher, `${base}[${i}]`);
      if (result) return result;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = base ? `${base}.${key}` : key;
    if (matcher(key, path)) {
      const num = asNumber(value, null);
      if (num !== null) return { path, value: num };
    }
    if (value && typeof value === 'object') {
      const result = findRecursiveNumber(value, matcher, path);
      if (result) return result;
    }
  }

  return null;
}

const QTY_AVAILABLE_PATHS = [
  'qtyAvailable',
  'quantityAvailable',
  'availableQty',
  'availableQuantity',
  'availableToSell',
  'available',
  'inventory.qtyAvailable',
  'inventory.quantityAvailable',
  'inventory.available',
  'part.qtyAvailable',
  'part.quantityAvailable',
  'product.qtyAvailable',
  'product.quantityAvailable',
  'raw.qtyAvailable',
  'raw.quantityAvailable',
];

const QTY_ON_HAND_PATHS = [
  'qtyOnHand',
  'quantityOnHand',
  'onHand',
  'onHandQty',
  'onHandQuantity',
  'inventory.qtyOnHand',
  'inventory.quantityOnHand',
  'inventory.onHand',
  'part.qtyOnHand',
  'part.quantityOnHand',
  'product.qtyOnHand',
  'product.quantityOnHand',
  'raw.qtyOnHand',
  'raw.quantityOnHand',
];

const QTY_ALLOCATED_PATHS = [
  'qtyAllocated',
  'quantityAllocated',
  'allocated',
  'allocatedQty',
  'committed',
  'committedQty',
  'inventory.qtyAllocated',
  'inventory.allocated',
];

const QTY_ON_ORDER_PATHS = [
  'qtyOnOrder',
  'quantityOnOrder',
  'onOrder',
  'onOrderQty',
  'inventory.qtyOnOrder',
  'inventory.onOrder',
];

const PRICE_PATHS = [
  'basePrice',
  'price',
  'product.price',
  'product.basePrice',
  'raw.product.price',
  'raw.product.basePrice',
];

function extractInventoryFromMerged(merged = {}) {
  const qtyAvailable =
    firstNumberByPaths(merged, QTY_AVAILABLE_PATHS) ||
    findRecursiveNumber(merged, (key) => /(qty|quantity).*available|available.*(qty|quantity)|availabletosell|^available$/i.test(key));

  const qtyOnHand =
    firstNumberByPaths(merged, QTY_ON_HAND_PATHS) ||
    findRecursiveNumber(merged, (key) => /(qty|quantity).*on.?hand|on.?hand.*(qty|quantity)|^on.?hand$/i.test(key));

  const qtyAllocated =
    firstNumberByPaths(merged, QTY_ALLOCATED_PATHS) ||
    findRecursiveNumber(merged, (key) => /(qty|quantity).*allocated|allocated.*(qty|quantity)|committed.*(qty|quantity)?|^allocated$/i.test(key));

  const qtyOnOrder =
    firstNumberByPaths(merged, QTY_ON_ORDER_PATHS) ||
    findRecursiveNumber(merged, (key) => /(qty|quantity).*on.?order|on.?order.*(qty|quantity)|^on.?order$/i.test(key));

  const hasAny = Boolean(qtyAvailable || qtyOnHand || qtyAllocated || qtyOnOrder);
  if (!hasAny) return null;

  return {
    qtyAvailable: qtyAvailable?.value ?? qtyOnHand?.value ?? 0,
    qtyOnHand: qtyOnHand?.value ?? qtyAvailable?.value ?? 0,
    qtyAllocated: qtyAllocated?.value ?? 0,
    qtyOnOrder: qtyOnOrder?.value ?? 0,
    paths: {
      qtyAvailable: qtyAvailable?.path || '',
      qtyOnHand: qtyOnHand?.path || '',
      qtyAllocated: qtyAllocated?.path || '',
      qtyOnOrder: qtyOnOrder?.path || '',
    },
  };
}

function extractPriceFromMerged(merged = {}) {
  return firstNumberByPaths(merged, PRICE_PATHS) || findRecursiveNumber(merged, (key) => /^(base)?price$/i.test(key));
}

function extractResults(data) {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];

  for (const key of ['results', 'data', 'items', 'parts', 'products', 'rows']) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

function getTotalPages(data) {
  return Number(data?.totalPages || data?.pageCount || data?.pages || 1) || 1;
}

function describeResponse(resp) {
  return {
    ok: !!resp?.ok,
    status: resp?.status,
    dataType: Array.isArray(resp?.data) ? 'array' : typeof resp?.data,
    keys: isObject(resp?.data) ? Object.keys(resp.data) : [],
    body: typeof resp?.data === 'string' ? resp.data.slice(0, 500) : resp?.data,
  };
}

async function requestPath(path) {
  const resp = await fishbowlClient.request({ method: 'GET', path });
  return resp;
}

async function fetchCollection(pathBase, { limit = 0, preferNoPagination = false } = {}) {
  const pageSize = 100;
  const barePath = pathBase;

  // Your older working script used /api/parts with no query params. Try that first.
  const bareResp = await requestPath(barePath);
  if (bareResp.ok) {
    const rows = extractResults(bareResp.data);
    const totalPages = getTotalPages(bareResp.data);
    console.log(`📄 ${pathBase} bare rows=${rows.length} totalPages=${totalPages}`);

    if (preferNoPagination || totalPages <= 1 || Array.isArray(bareResp.data)) {
      return limit ? rows.slice(0, limit) : rows;
    }
  } else {
    console.log(`⚠️ ${pathBase} bare failed`, JSON.stringify(describeResponse(bareResp), null, 2));
  }

  const pageStyles = [
    {
      name: 'pageNumber/pageSize',
      makePath: (page) => `${pathBase}?pageNumber=${page}&pageSize=${pageSize}`,
      nextPage: (page) => page + 1,
      done: (data, rows, page) => page >= getTotalPages(data) || rows.length === 0,
    },
    {
      name: 'page/pageSize',
      makePath: (page) => `${pathBase}?page=${page}&pageSize=${pageSize}`,
      nextPage: (page) => page + 1,
      done: (data, rows, page) => page >= getTotalPages(data) || rows.length === 0,
    },
    {
      name: 'page/limit',
      makePath: (page) => `${pathBase}?page=${page}&limit=${pageSize}`,
      nextPage: (page) => page + 1,
      done: (data, rows, page) => page >= getTotalPages(data) || rows.length < pageSize,
    },
    {
      name: 'offset/limit',
      makePath: (offset) => `${pathBase}?offset=${offset}&limit=${pageSize}`,
      nextPage: (offset) => offset + pageSize,
      done: (_data, rows) => rows.length < pageSize,
    },
  ];

  let lastFailure = null;

  for (const style of pageStyles) {
    const firstPath = style.makePath(style.name === 'offset/limit' ? 0 : 1);
    const firstResp = await requestPath(firstPath);

    if (!firstResp.ok) {
      lastFailure = { style: style.name, path: firstPath, response: describeResponse(firstResp) };
      continue;
    }

    const firstRows = extractResults(firstResp.data);
    if (!firstRows.length) {
      lastFailure = { style: style.name, path: firstPath, response: describeResponse(firstResp), note: 'No rows extracted' };
      continue;
    }

    console.log(`✅ ${pathBase} pagination style: ${style.name}`);

    const all = [...firstRows];
    let cursor = style.nextPage(style.name === 'offset/limit' ? 0 : 1);
    let pageCount = 1;
    console.log(`📄 ${pathBase} ${style.name} page 1 rows=${firstRows.length}`);

    while (!style.done(firstResp.data, firstRows, 1)) {
      if (limit && all.length >= limit) return all.slice(0, limit);
      if (pageCount > 500) break;

      const path = style.makePath(cursor);
      const resp = await requestPath(path);
      if (!resp.ok) {
        console.log(`⚠️ Stopping ${pathBase}; page request failed`, JSON.stringify({ path, response: describeResponse(resp) }, null, 2));
        break;
      }

      const rows = extractResults(resp.data);
      pageCount += 1;
      console.log(`📄 ${pathBase} ${style.name} page ${pageCount} rows=${rows.length}`);
      if (!rows.length) break;
      all.push(...rows);

      if (style.done(resp.data, rows, pageCount)) break;
      cursor = style.nextPage(cursor);
    }

    return limit ? all.slice(0, limit) : all;
  }

  throw new Error(`Could not fetch ${pathBase}. Last failure: ${JSON.stringify(lastFailure, null, 2)}`);
}

function rowKey(row = {}) {
  return clean(
    row.partNumber ||
      row.number ||
      row.num ||
      row.partNum ||
      row.sku ||
      row.productNumber ||
      row.name ||
      '',
  );
}

function buildMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = rowKey(row);
    if (key) map.set(key.toLowerCase(), row);
  }
  return map;
}

function buildBoltFilter() {
  return {
    $or: [
      { categoryHints: /bolt/i },
      { 'fishbowl.description': /bolt|c\/s|cap screw/i },
      { sku: /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
      { 'fishbowl.partNum': /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
    ],
  };
}

function inventoriesEqual(a = {}, b = {}) {
  return (
    Number(a.qtyOnHand || 0) === Number(b.qtyOnHand || 0) &&
    Number(a.qtyAvailable || 0) === Number(b.qtyAvailable || 0) &&
    Number(a.qtyAllocated || 0) === Number(b.qtyAllocated || 0) &&
    Number(a.qtyOnOrder || 0) === Number(b.qtyOnOrder || 0)
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const samples = process.argv.includes('--samples');
  const allProducts = process.argv.includes('--all-products');
  const preservePrice = process.argv.includes('--preserve-price');
  const noPagination = process.argv.includes('--no-pagination');
  const storeRaw = process.argv.includes('--store-raw');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) || 0 : 0;

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  if (dryRun) console.log('🔎 Dry run only');

  console.log('📦 Fetching Fishbowl parts...');
  const parts = await fetchCollection('/api/parts', { limit, preferNoPagination: noPagination });
  console.log(`✅ parts=${parts.length}`);

  console.log('💲 Fetching Fishbowl products...');
  const fishProducts = await fetchCollection('/api/products', { limit, preferNoPagination: noPagination });
  console.log(`✅ products=${fishProducts.length}`);

  const partMap = buildMap(parts);
  const productMap = buildMap(fishProducts);

  const targetFilter = allProducts ? { 'fishbowl.partNum': { $exists: true, $ne: '' } } : buildBoltFilter();
  const targetProducts = await Product.find(targetFilter)
    .select({ sku: 1, internalPartNumber: 1, fishbowl: 1, inventory: 1, pricing: 1 })
    .lean();

  const syncRun = dryRun
    ? null
    : await SyncRun.create({
        jobType: allProducts ? 'fishbowl-products-safe-resync' : 'fishbowl-bolts-safe-resync',
        status: 'running',
        startedAt: new Date(),
        stats: { found: targetProducts.length, created: 0, updated: 0, skipped: 0, failed: 0 },
        errors: [],
        notes: 'Safe Fishbowl resync. Updates inventory/pricing only. Does not overwrite enrichment, titles, descriptions, images, categories, attributes, review status, published status, slugs, or SEO.',
      });

  const summary = {
    targetProducts: targetProducts.length,
    matchedFishbowlRows: 0,
    withInventorySource: 0,
    withoutInventorySource: 0,
    inventoryUpdated: 0,
    priceUpdated: 0,
    skippedNoMatch: 0,
    unchanged: 0,
    failed: 0,
  };

  const sampleRows = { updates: [], noInventorySource: [], noMatch: [] };

  for (const dbProduct of targetProducts) {
    try {
      const key = clean(dbProduct?.fishbowl?.partNum || dbProduct.sku || dbProduct.internalPartNumber).toLowerCase();
      const part = partMap.get(key);
      const fishProduct = productMap.get(key);

      if (!part && !fishProduct) {
        summary.skippedNoMatch += 1;
        if (sampleRows.noMatch.length < 25) {
          sampleRows.noMatch.push({ partNumber: key, description: dbProduct?.fishbowl?.description || '' });
        }
        continue;
      }

      summary.matchedFishbowlRows += 1;
      const merged = { part, product: fishProduct, ...(part || {}), ...(fishProduct || {}) };
      const inventory = extractInventoryFromMerged(merged);
      const price = extractPriceFromMerged(merged);

      const updates = {};
      const before = { inventory: dbProduct.inventory || {}, pricing: dbProduct.pricing || {} };

      if (inventory) {
        summary.withInventorySource += 1;
        const nextInventory = {
          qtyOnHand: inventory.qtyOnHand,
          qtyAvailable: inventory.qtyAvailable,
          qtyAllocated: inventory.qtyAllocated,
          qtyOnOrder: inventory.qtyOnOrder,
          lastSyncedAt: new Date(),
        };

        if (!inventoriesEqual(before.inventory, nextInventory)) {
          updates.inventory = nextInventory;
        }
      } else {
        summary.withoutInventorySource += 1;
        if (sampleRows.noInventorySource.length < 25) {
          sampleRows.noInventorySource.push({
            partNumber: dbProduct?.fishbowl?.partNum || dbProduct.sku || '',
            description: dbProduct?.fishbowl?.description || '',
            currentInventory: dbProduct.inventory || {},
          });
        }
      }

      if (!preservePrice && price?.value !== undefined) {
        const currentPrice = asNumber(dbProduct?.pricing?.basePrice, null);
        if (currentPrice !== Number(price.value)) {
          updates['pricing.basePrice'] = price.value;
          updates['pricing.priceSource'] = 'fishbowl';
          updates['pricing.lastSyncedAt'] = new Date();
        }
      }

      if (storeRaw) {
        updates['fishbowl.raw.safeResync'] = {
          part,
          product: fishProduct,
          inventoryPaths: inventory?.paths || {},
          pricePath: price?.path || '',
          syncedAt: new Date(),
        };
      }

      const willUpdateInventory = Boolean(updates.inventory);
      const willUpdatePrice = Object.prototype.hasOwnProperty.call(updates, 'pricing.basePrice');

      if (!willUpdateInventory && !willUpdatePrice && !storeRaw) {
        summary.unchanged += 1;
        if (syncRun) syncRun.stats.skipped += 1;
        continue;
      }

      if (willUpdateInventory) summary.inventoryUpdated += 1;
      if (willUpdatePrice) summary.priceUpdated += 1;

      if (sampleRows.updates.length < 25) {
        sampleRows.updates.push({
          partNumber: dbProduct?.fishbowl?.partNum || dbProduct.sku || '',
          description: dbProduct?.fishbowl?.description || '',
          before,
          after: {
            inventory: updates.inventory || before.inventory,
            basePrice: willUpdatePrice ? updates['pricing.basePrice'] : before.pricing?.basePrice,
          },
          inventoryPaths: inventory?.paths || {},
          pricePath: price?.path || '',
        });
      }

      if (!dryRun) {
        await Product.updateOne({ _id: dbProduct._id }, { $set: updates });
        if (syncRun) syncRun.stats.updated += 1;
      }
    } catch (err) {
      summary.failed += 1;
      if (syncRun) {
        syncRun.stats.failed += 1;
        syncRun.errors.push({ key: dbProduct?.fishbowl?.partNum || dbProduct.sku || String(dbProduct._id), message: err.message, payload: null });
      }
    }
  }

  if (syncRun) {
    syncRun.status = summary.failed > 0 ? 'partial' : 'success';
    syncRun.finishedAt = new Date();
    await syncRun.save();
  }

  console.log('===== SAFE FISHBOWL PRODUCT RESYNC SUMMARY =====');
  console.log(JSON.stringify(summary, null, 2));
  if (samples) {
    console.log('===== SAMPLES =====');
    console.log(JSON.stringify(sampleRows, null, 2));
  }

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch(async (err) => {
  console.error('❌ Safe resync failed:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
