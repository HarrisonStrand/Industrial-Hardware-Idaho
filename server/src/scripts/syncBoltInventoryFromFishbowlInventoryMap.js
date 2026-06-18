import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePartNumber(value = "") {
  return clean(value).toUpperCase();
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function getByPath(obj, path = "") {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function appendQuery(path, params = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  if (!entries.length) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${entries.join("&")}`;
}

function getResultsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function isLikelyMorePages({ data, rows, pageNumber, pageSize, pageLimit }) {
  if (pageLimit > 0 && pageNumber >= pageLimit) return false;

  const totalPages = asNumber(data?.totalPages, null);
  if (totalPages !== null) return pageNumber < totalPages;

  const totalCount = asNumber(data?.totalCount, null);
  if (totalCount !== null) return pageNumber * pageSize < totalCount;

  return rows.length >= pageSize;
}

function buildInventorySnapshot({ quantity, existingInventory }) {
  const existing = existingInventory?.toObject?.() || existingInventory || {};
  return {
    ...existing,
    qtyOnHand: quantity,
    qtyAvailable: quantity,
    qtyAllocated: asNumber(existing.qtyAllocated, 0) ?? 0,
    qtyOnOrder: asNumber(existing.qtyOnOrder, 0) ?? 0,
    lastSyncedAt: new Date(),
  };
}

function inventoryChanged(product, nextInventory) {
  const before = product?.inventory || {};
  return (
    asNumber(before.qtyOnHand, 0) !== nextInventory.qtyOnHand ||
    asNumber(before.qtyAvailable, 0) !== nextInventory.qtyAvailable ||
    asNumber(before.qtyAllocated, 0) !== nextInventory.qtyAllocated ||
    asNumber(before.qtyOnOrder, 0) !== nextInventory.qtyOnOrder
  );
}

async function fetchFishbowlInventoryMap({
  inventoryPath,
  pageSize,
  pageLimit,
  partField,
  qtyField,
  samples,
}) {
  const inventoryByPartNumber = new Map();
  const sampleRows = [];

  const summary = {
    pagesRequested: 0,
    pagesFailed: 0,
    rowsFetched: 0,
    rowsMapped: 0,
    rowsWithoutPartNumber: 0,
    rowsWithoutQuantity: 0,
    duplicatePartRows: 0,
  };

  for (let pageNumber = 1; ; pageNumber += 1) {
    const path = appendQuery(inventoryPath, { pageNumber, pageSize });
    summary.pagesRequested += 1;

    const resp = await fishbowlClient.request({ method: "GET", path });
    if (!resp.ok) {
      summary.pagesFailed += 1;
      throw new Error(
        `Fishbowl inventory page request failed (${resp.status}) for ${path}: ${JSON.stringify(resp.data || resp.error || {})}`
      );
    }

    const rows = getResultsArray(resp.data);
    summary.rowsFetched += rows.length;

    for (const row of rows) {
      const partNumberRaw = getByPath(row, partField) ?? row.partNumber ?? row.number;
      const partNumber = normalizePartNumber(partNumberRaw);
      if (!partNumber) {
        summary.rowsWithoutPartNumber += 1;
        continue;
      }

      const quantity = asNumber(getByPath(row, qtyField) ?? row.quantity, null);
      if (quantity === null) {
        summary.rowsWithoutQuantity += 1;
        continue;
      }

      const existing = inventoryByPartNumber.get(partNumber);
      if (existing) {
        summary.duplicatePartRows += 1;
        existing.quantity += quantity;
        existing.rows.push(row);
      } else {
        inventoryByPartNumber.set(partNumber, {
          partNumber,
          quantity,
          rows: [row],
        });
        summary.rowsMapped += 1;
      }

      if (samples && sampleRows.length < 10) {
        sampleRows.push({
          partNumber,
          quantity,
          partDescription: row.partDescription || row.description || "",
        });
      }
    }

    if (!isLikelyMorePages({ data: resp.data, rows, pageNumber, pageSize, pageLimit })) break;
  }

  return { inventoryByPartNumber, summary, sampleRows };
}

async function getTargetProducts({ limit, partNumber, category }) {
  if (partNumber) {
    const normalized = normalizePartNumber(partNumber);
    return Product.find({
      isActive: { $ne: false },
      $or: [
        { "fishbowl.partNum": new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { sku: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        { internalPartNumber: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      ],
    }).sort({ "fishbowl.partNum": 1, sku: 1 });
  }

  const enrichmentQuery = {
    category: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    "attributes.familyType": { $exists: true, $ne: "" },
  };

  const enrichments = await ProductEnrichment.find(enrichmentQuery)
    .select({ productId: 1 })
    .lean();

  const ids = [...new Set(enrichments.map((item) => String(item.productId)).filter(Boolean))];
  let query = Product.find({ _id: { $in: ids }, isActive: { $ne: false } }).sort({ "fishbowl.partNum": 1, sku: 1 });
  if (limit > 0) query = query.limit(limit);
  return query;
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const samples = hasFlag("samples");
  const setMissingZero = hasFlag("set-missing-zero");

  const limit = Number(argValue("limit", "0")) || 0;
  const pageSize = Number(argValue("inventory-page-size", "100")) || 100;
  const pageLimit = Number(argValue("inventory-page-limit", "0")) || 0;
  const inventoryPath = clean(argValue("inventory-path", "/api/parts/inventory"));
  const partField = clean(argValue("part-field", "partNumber"));
  const qtyField = clean(argValue("qty-field", "quantity"));
  const category = clean(argValue("category", "bolts"));
  const onlyPart = clean(argValue("part", ""));

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
  if (dryRun) console.log("🔎 Dry run only");
  if (setMissingZero) console.log("⚠️ Missing Fishbowl inventory rows will be set to zero.");

  console.log("===== FETCHING FISHBOWL INVENTORY MAP =====");
  console.log(
    JSON.stringify(
      {
        FISHBOWL_BASE_URL: process.env.FISHBOWL_BASE_URL,
        inventoryPath,
        pageSize,
        pageLimit: pageLimit || "all",
        partField,
        qtyField,
      },
      null,
      2
    )
  );

  const { inventoryByPartNumber, summary: inventorySummary, sampleRows: inventorySamples } =
    await fetchFishbowlInventoryMap({
      inventoryPath,
      pageSize,
      pageLimit,
      partField,
      qtyField,
      samples,
    });

  const products = await getTargetProducts({ limit, partNumber: onlyPart, category });

  const syncSummary = {
    targetCategory: onlyPart ? "single-part" : category,
    requestedPart: onlyPart || null,
    targetProducts: products.length,
    checked: 0,
    updated: 0,
    wouldUpdate: 0,
    unchanged: 0,
    noPartIdentifier: 0,
    noInventoryRow: 0,
    setMissingZero: 0,
  };

  const syncSamples = [];

  for (const product of products) {
    const partNumber = clean(product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "");
    const normalizedPartNumber = normalizePartNumber(partNumber);

    if (!normalizedPartNumber) {
      syncSummary.noPartIdentifier += 1;
      continue;
    }

    syncSummary.checked += 1;
    const inventoryMatch = inventoryByPartNumber.get(normalizedPartNumber);

    if (!inventoryMatch && !setMissingZero) {
      syncSummary.noInventoryRow += 1;
      if (samples && syncSamples.length < 30) {
        syncSamples.push({
          partNumber,
          issue: "no inventory row returned by Fishbowl",
          current: {
            qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
            qtyAvailable: asNumber(product?.inventory?.qtyAvailable, 0),
          },
        });
      }
      continue;
    }

    const quantity = inventoryMatch ? inventoryMatch.quantity : 0;
    const nextInventory = buildInventorySnapshot({ quantity, existingInventory: product.inventory });
    const changed = inventoryChanged(product, nextInventory);

    if (!changed) {
      syncSummary.unchanged += 1;
      continue;
    }

    const sample = {
      partNumber,
      before: {
        qtyOnHand: asNumber(product?.inventory?.qtyOnHand, 0),
        qtyAvailable: asNumber(product?.inventory?.qtyAvailable, 0),
        qtyAllocated: asNumber(product?.inventory?.qtyAllocated, 0),
        qtyOnOrder: asNumber(product?.inventory?.qtyOnOrder, 0),
      },
      after: {
        qtyOnHand: nextInventory.qtyOnHand,
        qtyAvailable: nextInventory.qtyAvailable,
        qtyAllocated: nextInventory.qtyAllocated,
        qtyOnOrder: nextInventory.qtyOnOrder,
      },
      source: inventoryMatch
        ? {
            partNumber: inventoryMatch.partNumber,
            quantity: inventoryMatch.quantity,
            rowCount: inventoryMatch.rows.length,
          }
        : { missingInventoryRow: true, quantity: 0 },
    };

    if (samples && syncSamples.length < 30) syncSamples.push(sample);

    if (dryRun) {
      if (!inventoryMatch) syncSummary.setMissingZero += 1;
      syncSummary.wouldUpdate += 1;
      continue;
    }

    product.inventory = nextInventory;
    await product.save();

    if (!inventoryMatch) syncSummary.setMissingZero += 1;
    syncSummary.updated += 1;
  }

  console.log("===== FISHBOWL INVENTORY MAP SUMMARY =====");
  console.log(JSON.stringify(inventorySummary, null, 2));
  console.log(
    JSON.stringify(
      {
        uniqueMappedPartNumbers: inventoryByPartNumber.size,
      },
      null,
      2
    )
  );

  if (samples) {
    console.log("===== FISHBOWL INVENTORY MAP SAMPLES =====");
    console.log(JSON.stringify(inventorySamples, null, 2));
  }

  console.log("===== BOLT INVENTORY MAP SYNC SUMMARY =====");
  console.log(JSON.stringify(syncSummary, null, 2));

  if (samples) {
    console.log("===== SYNC SAMPLES =====");
    console.log(JSON.stringify(syncSamples, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Fishbowl inventory map sync failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
