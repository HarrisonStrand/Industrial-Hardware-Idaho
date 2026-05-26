import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    const stripped = value.replace(/[$,]/g, "").trim();
    if (!stripped) return fallback;
    const num = Number(stripped);
    return Number.isFinite(num) ? num : fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeKey(key = "") {
  return String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findNumbersDeep(input, wantedKeys = [], path = "", results = [], seen = new Set()) {
  if (!input || typeof input !== "object") return results;
  if (seen.has(input)) return results;
  seen.add(input);

  const wanted = new Set(wantedKeys.map(normalizeKey));

  for (const [key, value] of Object.entries(input)) {
    const nextPath = path ? `${path}.${key}` : key;
    const keyNorm = normalizeKey(key);

    if (wanted.has(keyNorm)) {
      const num = asNumber(value, null);
      if (num !== null) {
        results.push({ path: nextPath, value: num });
      }
    }

    if (value && typeof value === "object") {
      findNumbersDeep(value, wantedKeys, nextPath, results, seen);
    }
  }

  return results;
}

const QTY_AVAILABLE_KEYS = [
  "qtyAvailable",
  "quantityAvailable",
  "availableQty",
  "available",
  "qtyAvail",
  "quantityOnHandAvailable",
];

const QTY_ON_HAND_KEYS = [
  "qtyOnHand",
  "quantityOnHand",
  "onHand",
  "onhandQty",
  "qty",
  "quantity",
];

const PRICE_KEYS = [
  "basePrice",
  "salePrice",
  "price",
  "unitPrice",
  "listPrice",
  "standardPrice",
  "defaultPrice",
  "sellPrice",
];

function bestNumber(matches = [], { allowZero = true } = {}) {
  const cleanMatches = matches
    .map((item) => ({ ...item, value: asNumber(item.value, null) }))
    .filter((item) => item.value !== null)
    .filter((item) => (allowZero ? item.value >= 0 : item.value > 0));

  if (!cleanMatches.length) return null;

  const preferred = cleanMatches.find((item) => item.value > 0) || cleanMatches[0];
  return preferred;
}

function getRawContainers(product = {}) {
  return [
    { label: "fishbowl.raw", value: product?.fishbowl?.raw },
    { label: "fishbowl", value: product?.fishbowl },
  ].filter((item) => item.value && typeof item.value === "object");
}

function getCurrentSources(product = {}) {
  const qtyAvailable = asNumber(product?.inventory?.qtyAvailable, null);
  const qtyOnHand = asNumber(product?.inventory?.qtyOnHand, null);
  const basePrice = asNumber(product?.pricing?.basePrice, null);
  const salePrice = asNumber(product?.pricing?.salePrice, null);

  return {
    qtyAvailable,
    qtyOnHand,
    price: salePrice ?? basePrice,
    pricePath: salePrice !== null ? "pricing.salePrice" : basePrice !== null ? "pricing.basePrice" : "",
  };
}

function getRawSources(product = {}) {
  const rawContainers = getRawContainers(product);
  const qtyAvailableMatches = [];
  const qtyOnHandMatches = [];
  const priceMatches = [];

  for (const container of rawContainers) {
    findNumbersDeep(container.value, QTY_AVAILABLE_KEYS, container.label, qtyAvailableMatches);
    findNumbersDeep(container.value, QTY_ON_HAND_KEYS, container.label, qtyOnHandMatches);
    findNumbersDeep(container.value, PRICE_KEYS, container.label, priceMatches);
  }

  return {
    qtyAvailable: bestNumber(qtyAvailableMatches, { allowZero: true }),
    qtyOnHand: bestNumber(qtyOnHandMatches, { allowZero: true }),
    price: bestNumber(priceMatches, { allowZero: false }),
  };
}

function hasUsableInventory(product = {}) {
  return asNumber(product?.inventory?.qtyAvailable, null) !== null || asNumber(product?.inventory?.qtyOnHand, null) !== null;
}

function hasUsablePrice(product = {}) {
  return asNumber(product?.pricing?.salePrice, null) !== null || asNumber(product?.pricing?.basePrice, null) !== null;
}

function pushSample(samples, key, value, max = 20) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const showSamples = process.argv.includes("--samples");

  const enrichments = await ProductEnrichment.find(
    { category: /^bolts$/i },
    { productId: 1, title: 1, subcategory: 1, attributes: 1, images: 1 }
  ).lean();

  const productIds = enrichments.map((item) => item.productId).filter(Boolean);
  const products = await Product.find(
    { _id: { $in: productIds } },
    {
      sku: 1,
      internalPartNumber: 1,
      fishbowl: 1,
      inventory: 1,
      pricing: 1,
      isPublished: 1,
      catalogStatus: 1,
      review: 1,
    }
  ).lean();

  const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));

  const totals = {
    boltEnrichments: enrichments.length,
    productsFound: products.length,
    currentInventoryPresent: 0,
    currentPricePresent: 0,
    rawInventorySourceFound: 0,
    rawPriceSourceFound: 0,
    missingInventoryEverywhere: 0,
    missingPriceEverywhere: 0,
    zeroOrBlankCurrentQtyAvailable: 0,
    zeroOrBlankCurrentPrice: 0,
  };

  const sourcePathCounts = new Map();
  const samples = {};

  for (const product of products) {
    const enrichment = enrichmentMap.get(String(product._id));
    const current = getCurrentSources(product);
    const raw = getRawSources(product);
    const partNumber = clean(product?.fishbowl?.partNum || product?.sku || "");

    if (hasUsableInventory(product)) totals.currentInventoryPresent += 1;
    if (hasUsablePrice(product)) totals.currentPricePresent += 1;

    if (!current.qtyAvailable || current.qtyAvailable <= 0) totals.zeroOrBlankCurrentQtyAvailable += 1;
    if (!current.price || current.price <= 0) totals.zeroOrBlankCurrentPrice += 1;

    if (raw.qtyAvailable || raw.qtyOnHand) {
      totals.rawInventorySourceFound += 1;
      for (const item of [raw.qtyAvailable, raw.qtyOnHand].filter(Boolean)) {
        sourcePathCounts.set(item.path, (sourcePathCounts.get(item.path) || 0) + 1);
      }
    } else if (!hasUsableInventory(product)) {
      totals.missingInventoryEverywhere += 1;
      pushSample(samples, "missingInventoryEverywhere", {
        partNumber,
        description: product?.fishbowl?.description || "",
        title: enrichment?.title || "",
        currentInventory: product?.inventory || {},
      });
    }

    if (raw.price) {
      totals.rawPriceSourceFound += 1;
      sourcePathCounts.set(raw.price.path, (sourcePathCounts.get(raw.price.path) || 0) + 1);
    } else if (!hasUsablePrice(product)) {
      totals.missingPriceEverywhere += 1;
      pushSample(samples, "missingPriceEverywhere", {
        partNumber,
        description: product?.fishbowl?.description || "",
        title: enrichment?.title || "",
        currentPricing: product?.pricing || {},
      });
    }

    if (showSamples && (!current.price || current.price <= 0 || !current.qtyAvailable || current.qtyAvailable <= 0)) {
      pushSample(samples, "needsDisplayFixOrBackfill", {
        partNumber,
        description: product?.fishbowl?.description || "",
        title: enrichment?.title || "",
        current,
        raw,
        productInventory: product?.inventory || {},
        productPricing: product?.pricing || {},
      });
    }
  }

  console.log("===== BOLT PRICING / INVENTORY SOURCE AUDIT =====");
  console.log(JSON.stringify(totals, null, 2));

  console.log("===== SOURCE PATH COUNTS =====");
  console.log(JSON.stringify(
    Array.from(sourcePathCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50),
    null,
    2
  ));

  if (showSamples) {
    console.log("===== SAMPLES =====");
    console.log(JSON.stringify(samples, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Bolt pricing/inventory audit failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
