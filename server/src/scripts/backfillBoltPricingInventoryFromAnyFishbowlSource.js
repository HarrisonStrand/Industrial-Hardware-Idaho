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
      if (num !== null) results.push({ path: nextPath, value: num });
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
  return cleanMatches.find((item) => item.value > 0) || cleanMatches[0];
}

function getRawContainers(product = {}) {
  return [
    { label: "fishbowl.raw", value: product?.fishbowl?.raw },
    { label: "fishbowl", value: product?.fishbowl },
  ].filter((item) => item.value && typeof item.value === "object");
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

function shouldFillInventory(product = {}) {
  const qtyAvailable = asNumber(product?.inventory?.qtyAvailable, null);
  const qtyOnHand = asNumber(product?.inventory?.qtyOnHand, null);
  return qtyAvailable === null || qtyOnHand === null;
}

function shouldFillPrice(product = {}) {
  const basePrice = asNumber(product?.pricing?.basePrice, null);
  const salePrice = asNumber(product?.pricing?.salePrice, null);
  return basePrice === null && salePrice === null;
}

function pushSample(samples, key, value, max = 25) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < max) samples[key].push(value);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const dryRun = process.argv.includes("--dry-run");
  const showSamples = process.argv.includes("--samples");
  const overwriteZero = process.argv.includes("--overwrite-zero");

  console.log(dryRun ? "🔎 Dry run only" : "✍️ Applying bolt pricing/inventory backfill");

  const enrichments = await ProductEnrichment.find(
    { category: /^bolts$/i },
    { productId: 1, title: 1, subcategory: 1, attributes: 1 }
  ).lean();

  const productIds = enrichments.map((item) => item.productId).filter(Boolean);
  const enrichmentMap = new Map(enrichments.map((item) => [String(item.productId), item]));
  const products = await Product.find({ _id: { $in: productIds } });

  const summary = {
    boltProducts: products.length,
    updatedInventory: 0,
    updatedPricing: 0,
    missingRawInventory: 0,
    missingRawPrice: 0,
    unchanged: 0,
  };

  const samples = {};
  const now = new Date();

  for (const product of products) {
    const productObject = product.toObject();
    const enrichment = enrichmentMap.get(String(product._id));
    const raw = getRawSources(productObject);
    const partNumber = clean(product?.fishbowl?.partNum || product?.sku || "");

    let changed = false;
    const before = {
      inventory: { ...(product.inventory?.toObject?.() || product.inventory || {}) },
      pricing: { ...(product.pricing?.toObject?.() || product.pricing || {}) },
    };

    const currentQtyAvailable = asNumber(product?.inventory?.qtyAvailable, null);
    const currentQtyOnHand = asNumber(product?.inventory?.qtyOnHand, null);
    const currentBasePrice = asNumber(product?.pricing?.basePrice, null);
    const currentSalePrice = asNumber(product?.pricing?.salePrice, null);

    const needsQtyAvailable = currentQtyAvailable === null || (overwriteZero && currentQtyAvailable <= 0);
    const needsQtyOnHand = currentQtyOnHand === null || (overwriteZero && currentQtyOnHand <= 0);
    const needsPrice = (currentBasePrice === null && currentSalePrice === null) || (overwriteZero && (currentSalePrice === null || currentSalePrice <= 0) && (currentBasePrice === null || currentBasePrice <= 0));

    if (needsQtyAvailable || needsQtyOnHand) {
      if (raw.qtyAvailable || raw.qtyOnHand) {
        if (needsQtyAvailable) {
          product.inventory.qtyAvailable = Number((raw.qtyAvailable || raw.qtyOnHand).value || 0);
          changed = true;
        }
        if (needsQtyOnHand) {
          product.inventory.qtyOnHand = Number((raw.qtyOnHand || raw.qtyAvailable).value || 0);
          changed = true;
        }
        product.inventory.lastSyncedAt = now;
        summary.updatedInventory += 1;
      } else {
        summary.missingRawInventory += 1;
        if (showSamples) {
          pushSample(samples, "missingRawInventory", {
            partNumber,
            title: enrichment?.title || "",
            description: product?.fishbowl?.description || "",
            current: before.inventory,
          });
        }
      }
    }

    if (needsPrice) {
      if (raw.price) {
        product.pricing.basePrice = Number(raw.price.value);
        if (asNumber(product?.pricing?.salePrice, null) !== null && overwriteZero && asNumber(product?.pricing?.salePrice, null) <= 0) {
          product.pricing.salePrice = null;
        }
        product.pricing.priceSource = "fishbowl";
        product.pricing.lastSyncedAt = now;
        changed = true;
        summary.updatedPricing += 1;
      } else {
        summary.missingRawPrice += 1;
        if (showSamples) {
          pushSample(samples, "missingRawPrice", {
            partNumber,
            title: enrichment?.title || "",
            description: product?.fishbowl?.description || "",
            current: before.pricing,
          });
        }
      }
    }

    if (changed) {
      if (showSamples) {
        pushSample(samples, "updated", {
          partNumber,
          title: enrichment?.title || "",
          description: product?.fishbowl?.description || "",
          before,
          after: {
            inventory: product.inventory?.toObject?.() || product.inventory || {},
            pricing: product.pricing?.toObject?.() || product.pricing || {},
          },
          rawSource: raw,
        });
      }

      if (!dryRun) await product.save();
    } else {
      summary.unchanged += 1;
    }
  }

  console.log("===== BOLT PRICING / INVENTORY BACKFILL SUMMARY =====");
  console.log(JSON.stringify(summary, null, 2));

  if (showSamples) {
    console.log("===== SAMPLES =====");
    console.log(JSON.stringify(samples, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Bolt pricing/inventory backfill failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
