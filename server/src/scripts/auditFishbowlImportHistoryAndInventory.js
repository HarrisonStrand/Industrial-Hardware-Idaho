import '../config/env.js';
import mongoose from 'mongoose';

import Product from '../models/Product.js';
import SyncRun from '../models/SyncRun.js';

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isNonZero(value) {
  return n(value) > 0;
}

async function count(filter) {
  return Product.countDocuments(filter);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const syncRuns = await SyncRun.find({ jobType: /fishbowl/i })
    .sort({ startedAt: -1, createdAt: -1 })
    .limit(10)
    .lean();

  const totals = {
    totalProducts: await count({}),
    productsWithFishbowlPart: await count({ 'fishbowl.partNum': { $exists: true, $ne: '' } }),
    productsWithQtyAvailableGtZero: await count({ 'inventory.qtyAvailable': { $gt: 0 } }),
    productsWithQtyOnHandGtZero: await count({ 'inventory.qtyOnHand': { $gt: 0 } }),
    productsWithBothQtyZero: await count({
      $or: [{ 'fishbowl.partNum': { $exists: true, $ne: '' } }, { sku: { $exists: true, $ne: '' } }],
      'inventory.qtyAvailable': { $in: [0, null] },
      'inventory.qtyOnHand': { $in: [0, null] },
    }),
    productsWithBasePriceGtZero: await count({ 'pricing.basePrice': { $gt: 0 } }),
    productsWithBasePriceZeroOrMissing: await count({
      $or: [
        { 'pricing.basePrice': { $exists: false } },
        { 'pricing.basePrice': null },
        { 'pricing.basePrice': 0 },
      ],
    }),
    boltProducts: await count({
      $or: [
        { categoryHints: /bolt/i },
        { 'fishbowl.description': /bolt|c\/s|cap screw/i },
        { sku: /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
        { 'fishbowl.partNum': /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
      ],
    }),
    boltProductsWithQtyAvailableGtZero: await count({
      $and: [
        {
          $or: [
            { categoryHints: /bolt/i },
            { 'fishbowl.description': /bolt|c\/s|cap screw/i },
            { sku: /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
            { 'fishbowl.partNum': /^(?:A325|MMCS|CS|SSCS|SHCS|BHCS|FHCS|MMSH|MMSB|MMSF)/i },
          ],
        },
        { 'inventory.qtyAvailable': { $gt: 0 } },
      ],
    }),
  };

  const sampleZeroQtyPriced = await Product.find({
    'pricing.basePrice': { $gt: 0 },
    'inventory.qtyAvailable': { $in: [0, null] },
    'inventory.qtyOnHand': { $in: [0, null] },
  })
    .select({ sku: 1, internalPartNumber: 1, fishbowl: 1, inventory: 1, pricing: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();

  console.log('===== FISHBOWL IMPORT / INVENTORY AUDIT =====');
  console.log(JSON.stringify({ totals }, null, 2));

  console.log('\n===== RECENT FISHBOWL SYNC RUNS =====');
  console.log(JSON.stringify(syncRuns.map((run) => ({
    id: String(run._id),
    jobType: run.jobType,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    stats: run.stats,
    errorCount: Array.isArray(run.errors) ? run.errors.length : 0,
    notes: run.notes,
  })), null, 2));

  console.log('\n===== SAMPLE ZERO-QTY / PRICED PRODUCTS =====');
  console.log(JSON.stringify(sampleZeroQtyPriced.map((p) => ({
    partNumber: p?.fishbowl?.partNum || p.sku || '',
    description: p?.fishbowl?.description || '',
    inventory: p.inventory,
    pricing: p.pricing,
    updatedAt: p.updatedAt,
  })), null, 2));

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch(async (err) => {
  console.error('❌ Audit failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
