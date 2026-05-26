import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function asArrayFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.inventory)) return data.inventory;
  if (Array.isArray(data?.quantities)) return data.quantities;
  if (data && typeof data === "object") return [data];
  return [];
}

function summarize(value, depth = 0) {
  if (depth > 2) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return {
      kind: "array",
      length: value.length,
      sample: value.slice(0, 2).map((item) => summarize(item, depth + 1)),
    };
  }
  if (value && typeof value === "object") {
    const out = { kind: "object", keys: Object.keys(value).slice(0, 40) };
    for (const key of Object.keys(value).slice(0, 12)) {
      const child = value[key];
      if (Array.isArray(child)) out[`${key}Summary`] = summarize(child, depth + 1);
      else if (child && typeof child === "object") out[key] = summarize(child, depth + 1);
      else out[key] = child;
    }
    return out;
  }
  return value;
}

function isQtyKey(key = "") {
  const normalized = String(key || "").toLowerCase();
  return (
    normalized.includes("qty") ||
    normalized.includes("quantity") ||
    normalized.includes("available") ||
    normalized.includes("onhand") ||
    normalized.includes("on_hand") ||
    normalized.includes("allocated") ||
    normalized.includes("committed") ||
    normalized.includes("onorder") ||
    normalized.includes("on_order")
  );
}

function collectQtyCandidates(value, prefix = "", results = []) {
  if (!value || typeof value !== "object") return results;

  if (Array.isArray(value)) {
    value.slice(0, 5).forEach((item, index) =>
      collectQtyCandidates(item, `${prefix}[${index}]`, results),
    );
    return results;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isQtyKey(key) && (typeof child === "number" || typeof child === "string")) {
      const num = Number(child);
      if (Number.isFinite(num)) results.push({ path, value: num });
    }
    if (child && typeof child === "object") collectQtyCandidates(child, path, results);
  }

  return results;
}

async function findSampleProduct(partNumber = "") {
  if (partNumber) {
    const exact = await Product.findOne({
      $or: [
        { "fishbowl.partNum": new RegExp(`^${partNumber}$`, "i") },
        { sku: new RegExp(`^${partNumber}$`, "i") },
        { internalPartNumber: new RegExp(`^${partNumber}$`, "i") },
      ],
    }).lean();
    if (exact) return exact;
  }

  const enrichment = await ProductEnrichment.findOne({
    category: /^bolts$/i,
    "attributes.familyType": { $exists: true, $ne: "" },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!enrichment) return null;
  return Product.findById(enrichment.productId).lean();
}

function buildPaths({ partNumber, partId }) {
  const encodedPart = encodeURIComponent(partNumber || "");
  const encodedId = encodeURIComponent(partId || "");

  return [
    ["inventory baseline", "/api/inventory"],
    ["inventory by partNumber", `/api/inventory?partNumber=${encodedPart}`],
    ["inventory by partNum", `/api/inventory?partNum=${encodedPart}`],
    ["inventory by number", `/api/inventory?number=${encodedPart}`],
    ["inventory by partId", `/api/inventory?partId=${encodedId}`],
    ["part inventory by partNumber", `/api/part-inventory?partNumber=${encodedPart}`],
    ["part inventory by partNum", `/api/part-inventory?partNum=${encodedPart}`],
    ["part inventory by number", `/api/part-inventory?number=${encodedPart}`],
    ["part quantities by partNumber", `/api/part-quantities?partNumber=${encodedPart}`],
    ["part quantities by partNum", `/api/part-quantities?partNum=${encodedPart}`],
    ["part quantities by number", `/api/part-quantities?number=${encodedPart}`],
    ["quantities by partNumber", `/api/quantities?partNumber=${encodedPart}`],
    ["quantities by partNum", `/api/quantities?partNum=${encodedPart}`],
    ["parts id inventory", encodedId ? `/api/parts/${encodedId}/inventory` : ""],
    ["parts id quantities", encodedId ? `/api/parts/${encodedId}/quantities` : ""],
    ["parts number inventory", encodedPart ? `/api/parts/${encodedPart}/inventory` : ""],
    ["products by partNumber", `/api/products?partNumber=${encodedPart}`],
    ["products by number", `/api/products?number=${encodedPart}`],
    ["parts by number", `/api/parts?number=${encodedPart}`],
  ].filter(([, path]) => path);
}

async function main() {
  const partArg = clean(argValue("part", ""));

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const sampleProduct = await findSampleProduct(partArg);
  if (!sampleProduct) {
    throw new Error("No sample product found. Pass --part=PARTNUMBER.");
  }

  const partNumber = clean(sampleProduct?.fishbowl?.partNum || sampleProduct?.sku || "");
  const partId = clean(sampleProduct?.fishbowl?.partId || "");

  console.log("===== SAMPLE PRODUCT =====");
  console.log(JSON.stringify({ partNumber, partId, description: sampleProduct?.fishbowl?.description || "" }, null, 2));

  const paths = buildPaths({ partNumber, partId });
  const working = [];

  for (const [label, path] of paths) {
    try {
      const resp = await fishbowlClient.request({ method: "GET", path });
      const rows = asArrayFromResponse(resp.data);
      const qtyCandidates = collectQtyCandidates(resp.data).slice(0, 30);

      console.log(`\n=== ${label} ===`);
      console.log(`PATH: ${path}`);
      console.log(`STATUS: ${resp.status}`);
      console.log(`OK: ${resp.ok}`);
      console.log("QTY CANDIDATES:");
      console.log(JSON.stringify(qtyCandidates, null, 2));
      console.log("DATA SUMMARY:");
      console.log(JSON.stringify(summarize(resp.data), null, 2));

      if (resp.ok && qtyCandidates.length) {
        working.push({ label, path, qtyCandidates, rowCount: rows.length });
      }
    } catch (err) {
      console.log(`\n=== ${label} ===`);
      console.log(`PATH: ${path}`);
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log("\n===== LIKELY INVENTORY SOURCES =====");
  console.log(JSON.stringify(working, null, 2));

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Inventory endpoint discovery failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
