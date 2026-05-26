import "../config/env.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((v) => clean(v)));
}

function asNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeHeader(value = "") {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers = [], candidates = []) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedCandidates = candidates.map(normalizeHeader);

  for (const candidate of normalizedCandidates) {
    const index = normalizedHeaders.indexOf(candidate);
    if (index >= 0) return index;
  }

  for (const candidate of normalizedCandidates) {
    const index = normalizedHeaders.findIndex((header) => header.includes(candidate) || candidate.includes(header));
    if (index >= 0) return index;
  }

  return -1;
}

function getCell(row = [], index = -1) {
  if (index < 0) return "";
  return clean(row[index] || "");
}

async function getBoltProductIds() {
  const enrichments = await ProductEnrichment.find({
    category: /^bolts$/i,
    "attributes.familyType": { $exists: true, $ne: "" },
  })
    .select({ productId: 1 })
    .lean();

  return [...new Set(enrichments.map((item) => String(item.productId)).filter(Boolean))];
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const samples = hasFlag("samples");
  const filePath = argValue("file", "");

  if (!filePath) {
    throw new Error("CSV file path is required. Use --file=/path/to/fishbowl-inventory.csv");
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const csvRows = parseCsv(fs.readFileSync(resolvedPath, "utf8"));
  if (csvRows.length < 2) {
    throw new Error("CSV does not appear to contain a header row and data rows.");
  }

  const headers = csvRows[0];
  const dataRows = csvRows.slice(1);

  const partIndex = findHeaderIndex(headers, [
    "Part Number",
    "PartNum",
    "Part Num",
    "Number",
    "Part",
    "SKU",
    "Item Number",
    "Item",
  ]);

  const qtyAvailableIndex = findHeaderIndex(headers, [
    "Qty Available",
    "Available Qty",
    "Quantity Available",
    "Available",
    "Avail",
  ]);

  const qtyOnHandIndex = findHeaderIndex(headers, [
    "Qty On Hand",
    "On Hand Qty",
    "Quantity On Hand",
    "On Hand",
    "QtyOnHand",
  ]);

  const qtyAllocatedIndex = findHeaderIndex(headers, [
    "Qty Allocated",
    "Allocated Qty",
    "Quantity Allocated",
    "Allocated",
    "Committed",
  ]);

  const qtyOnOrderIndex = findHeaderIndex(headers, [
    "Qty On Order",
    "On Order Qty",
    "Quantity On Order",
    "On Order",
  ]);

  if (partIndex < 0) {
    throw new Error(`Could not find a part number column. Headers: ${headers.join(" | ")}`);
  }

  if (qtyAvailableIndex < 0 && qtyOnHandIndex < 0) {
    throw new Error(`Could not find quantity columns. Headers: ${headers.join(" | ")}`);
  }

  const inventoryByPart = new Map();
  for (const row of dataRows) {
    const partNumber = getCell(row, partIndex);
    if (!partNumber) continue;

    const qtyAvailable = asNumber(getCell(row, qtyAvailableIndex), null);
    const qtyOnHand = asNumber(getCell(row, qtyOnHandIndex), null);
    const qtyAllocated = asNumber(getCell(row, qtyAllocatedIndex), 0);
    const qtyOnOrder = asNumber(getCell(row, qtyOnOrderIndex), 0);

    inventoryByPart.set(normalize(partNumber), {
      partNumber,
      qtyAvailable: qtyAvailable ?? qtyOnHand ?? 0,
      qtyOnHand: qtyOnHand ?? qtyAvailable ?? 0,
      qtyAllocated: qtyAllocated ?? 0,
      qtyOnOrder: qtyOnOrder ?? 0,
    });
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");
  if (dryRun) console.log("🔎 Dry run only");

  const boltProductIds = await getBoltProductIds();
  const products = await Product.find({ _id: { $in: boltProductIds }, isActive: { $ne: false } });

  const summary = {
    csvRows: dataRows.length,
    csvInventoryRows: inventoryByPart.size,
    boltProducts: products.length,
    matched: 0,
    wouldUpdate: 0,
    updated: 0,
    unchanged: 0,
    noCsvMatch: 0,
  };

  const sampleRows = [];

  for (const product of products) {
    const identifiers = [
      product?.fishbowl?.partNum,
      product?.sku,
      product?.internalPartNumber,
    ]
      .map((value) => normalize(value))
      .filter(Boolean);

    const inventory = identifiers.map((id) => inventoryByPart.get(id)).find(Boolean);

    if (!inventory) {
      summary.noCsvMatch += 1;
      if (samples && sampleRows.length < 20) {
        sampleRows.push({ partNumber: product?.fishbowl?.partNum || product?.sku || "", issue: "no csv match" });
      }
      continue;
    }

    summary.matched += 1;

    const before = {
      qtyOnHand: Number(product?.inventory?.qtyOnHand || 0),
      qtyAvailable: Number(product?.inventory?.qtyAvailable || 0),
      qtyAllocated: Number(product?.inventory?.qtyAllocated || 0),
      qtyOnOrder: Number(product?.inventory?.qtyOnOrder || 0),
    };

    const after = {
      qtyOnHand: inventory.qtyOnHand,
      qtyAvailable: inventory.qtyAvailable,
      qtyAllocated: inventory.qtyAllocated,
      qtyOnOrder: inventory.qtyOnOrder,
    };

    const changed =
      before.qtyOnHand !== after.qtyOnHand ||
      before.qtyAvailable !== after.qtyAvailable ||
      before.qtyAllocated !== after.qtyAllocated ||
      before.qtyOnOrder !== after.qtyOnOrder;

    if (!changed) {
      summary.unchanged += 1;
      continue;
    }

    if (samples && sampleRows.length < 30) {
      sampleRows.push({
        partNumber: product?.fishbowl?.partNum || product?.sku || "",
        csvPartNumber: inventory.partNumber,
        before,
        after,
      });
    }

    if (dryRun) {
      summary.wouldUpdate += 1;
      continue;
    }

    product.inventory = {
      ...(product.inventory?.toObject?.() || product.inventory || {}),
      ...after,
      lastSyncedAt: new Date(),
    };

    await product.save();
    summary.updated += 1;
  }

  console.log("===== BOLT INVENTORY CSV BACKFILL SUMMARY =====");
  console.log(JSON.stringify(summary, null, 2));
  if (samples) {
    console.log("===== SAMPLES =====");
    console.log(JSON.stringify(sampleRows, null, 2));
  }

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Bolt inventory CSV backfill failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
