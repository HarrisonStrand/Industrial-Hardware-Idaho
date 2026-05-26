import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
  return clean(value).toLowerCase();
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
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getByPath(obj, path = "") {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function asArrayFromResponse(data, listPath = "") {
  if (listPath) {
    const value = getByPath(data, listPath);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.inventory)) return data.inventory;
  if (Array.isArray(data?.quantities)) return data.quantities;
  if (data && typeof data === "object") return [data];
  return [];
}

function findRecursiveNumber(obj, keys = []) {
  if (!obj || typeof obj !== "object") return null;
  const normalizedKeys = keys.map(normalize);

  const directEntries = Object.entries(obj);
  for (const [key, value] of directEntries) {
    if (normalizedKeys.includes(normalize(key))) {
      const num = asNumber(value, null);
      if (num !== null) return num;
    }
  }

  for (const [, value] of directEntries) {
    if (value && typeof value === "object") {
      const found = findRecursiveNumber(value, keys);
      if (found !== null) return found;
    }
  }

  return null;
}

function extractInventory(row = {}, pathConfig = {}) {
  const qtyAvailable =
    asNumber(getByPath(row, pathConfig.qtyAvailablePath), null) ??
    findRecursiveNumber(row, [
      "qtyAvailable",
      "availableQty",
      "quantityAvailable",
      "availableQuantity",
      "available",
      "qtyAvail",
    ]);

  const qtyOnHand =
    asNumber(getByPath(row, pathConfig.qtyOnHandPath), null) ??
    findRecursiveNumber(row, [
      "qtyOnHand",
      "onHandQty",
      "quantityOnHand",
      "onHandQuantity",
      "onHand",
      "qtyOnHandTotal",
    ]);

  const qtyAllocated =
    asNumber(getByPath(row, pathConfig.qtyAllocatedPath), null) ??
    findRecursiveNumber(row, ["qtyAllocated", "allocatedQty", "quantityAllocated", "allocated", "committed"]);

  const qtyOnOrder =
    asNumber(getByPath(row, pathConfig.qtyOnOrderPath), null) ??
    findRecursiveNumber(row, ["qtyOnOrder", "onOrderQty", "quantityOnOrder", "onOrder"]);

  if (qtyAvailable === null && qtyOnHand === null && qtyAllocated === null && qtyOnOrder === null) {
    return null;
  }

  return {
    qtyAvailable: qtyAvailable ?? 0,
    qtyOnHand: qtyOnHand ?? qtyAvailable ?? 0,
    qtyAllocated: qtyAllocated ?? 0,
    qtyOnOrder: qtyOnOrder ?? 0,
  };
}

function rowMatchesProduct(row = {}, product = {}) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || "").toLowerCase();
  const partId = clean(product?.fishbowl?.partId || "").toLowerCase();
  const text = JSON.stringify(row || {}).toLowerCase();
  return (partNumber && text.includes(partNumber)) || (partId && text.includes(partId));
}

function buildPath({ endpoint, mode, param, product }) {
  const partNumber = clean(product?.fishbowl?.partNum || product?.sku || "");
  const partId = clean(product?.fishbowl?.partId || "");
  const value = param === "partId" ? partId : partNumber;
  const encoded = encodeURIComponent(value);

  if (!endpoint) return "";
  if (mode === "path") return `${endpoint.replace(/\/+$/, "")}/${encoded}`;
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${encodeURIComponent(param)}=${encoded}`;
}

async function getBoltProducts(limit = 0) {
  const enrichments = await ProductEnrichment.find({
    category: /^bolts$/i,
    "attributes.familyType": { $exists: true, $ne: "" },
  })
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
  const limit = Number(argValue("limit", "0")) || 0;
  const endpoint = clean(argValue("endpoint", "/api/inventory"));
  const mode = clean(argValue("mode", "query"));
  const param = clean(argValue("param", "partNumber"));
  const listPath = clean(argValue("list-path", ""));

  const pathConfig = {
    qtyAvailablePath: clean(argValue("qty-available-path", "")),
    qtyOnHandPath: clean(argValue("qty-on-hand-path", "")),
    qtyAllocatedPath: clean(argValue("qty-allocated-path", "")),
    qtyOnOrderPath: clean(argValue("qty-on-order-path", "")),
  };

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
  if (dryRun) console.log("🔎 Dry run only");

  const products = await getBoltProducts(limit);

  const summary = {
    boltProducts: products.length,
    checked: 0,
    updated: 0,
    wouldUpdate: 0,
    noPartIdentifier: 0,
    requestFailed: 0,
    noRows: 0,
    noMatchingRow: 0,
    noQtyFound: 0,
    unchanged: 0,
  };

  const sampleRows = [];

  for (const product of products) {
    const partNumber = clean(product?.fishbowl?.partNum || product?.sku || "");
    const partId = clean(product?.fishbowl?.partId || "");
    if (!partNumber && !partId) {
      summary.noPartIdentifier += 1;
      continue;
    }

    const path = buildPath({ endpoint, mode, param, product });
    summary.checked += 1;

    const resp = await fishbowlClient.request({ method: "GET", path });
    if (!resp.ok) {
      summary.requestFailed += 1;
      if (samples && sampleRows.length < 20) sampleRows.push({ partNumber, path, status: resp.status, error: resp.data });
      continue;
    }

    const rows = asArrayFromResponse(resp.data, listPath);
    if (!rows.length) {
      summary.noRows += 1;
      continue;
    }

    const matchingRow = rows.find((row) => rowMatchesProduct(row, product)) || (rows.length === 1 ? rows[0] : null);
    if (!matchingRow) {
      summary.noMatchingRow += 1;
      if (samples && sampleRows.length < 20) sampleRows.push({ partNumber, path, rowCount: rows.length, issue: "no matching row" });
      continue;
    }

    const inventory = extractInventory(matchingRow, pathConfig);
    if (!inventory) {
      summary.noQtyFound += 1;
      if (samples && sampleRows.length < 20) sampleRows.push({ partNumber, path, issue: "no qty found", sampleRow: matchingRow });
      continue;
    }

    const before = {
      qtyOnHand: Number(product?.inventory?.qtyOnHand || 0),
      qtyAvailable: Number(product?.inventory?.qtyAvailable || 0),
      qtyAllocated: Number(product?.inventory?.qtyAllocated || 0),
      qtyOnOrder: Number(product?.inventory?.qtyOnOrder || 0),
    };

    const changed =
      before.qtyOnHand !== inventory.qtyOnHand ||
      before.qtyAvailable !== inventory.qtyAvailable ||
      before.qtyAllocated !== inventory.qtyAllocated ||
      before.qtyOnOrder !== inventory.qtyOnOrder;

    if (!changed) {
      summary.unchanged += 1;
      continue;
    }

    if (samples && sampleRows.length < 30) {
      sampleRows.push({ partNumber, path, before, after: inventory });
    }

    if (dryRun) {
      summary.wouldUpdate += 1;
      continue;
    }

    product.inventory = {
      ...(product.inventory?.toObject?.() || product.inventory || {}),
      ...inventory,
      lastSyncedAt: new Date(),
    };

    await product.save();
    summary.updated += 1;
  }

  console.log("===== LIVE FISHBOWL BOLT INVENTORY SYNC SUMMARY =====");
  console.log(JSON.stringify(summary, null, 2));
  if (samples) {
    console.log("===== SAMPLES =====");
    console.log(JSON.stringify(sampleRows, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Live Fishbowl inventory sync failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
