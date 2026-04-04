import dotenv from "dotenv";
import mongoose from "mongoose";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";
import runFishbowlProductImport from "../services/catalog/runFishbowlProductImport.js";

dotenv.config();

function asString(v, fallback = "") {
  return v == null ? fallback : String(v).trim();
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchAllPages(path) {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  let all = [];

  while (page <= totalPages) {
    const resp = await fishbowlClient.request({
      method: "GET",
      path: `${path}?pageNumber=${page}&pageSize=${pageSize}`,
    });

    if (!resp.ok) {
      throw new Error(`Failed ${path}: ${resp.status}`);
    }

    const data = resp.data;

    totalPages = data.totalPages || 1;

    console.log(`📄 ${path} page ${page}/${totalPages}`);

    all.push(...(data.results || []));

    page++;
  }

  return all;
}

function buildProductMap(products = []) {
  const map = new Map();

  for (const p of products) {
    const key = asString(p.partNumber || p.number);
    if (!key) continue;

    map.set(key, p);
  }

  return map;
}

function mapMerged(part, productMap) {
  const key = asString(part.number);
  const product = productMap.get(key);

  return {
    partId: part.id,
    partNum: key,
    description: asString(part.description),
    type: asString(part.type),
    uom: asString(part?.uom?.name),

    active: part.active ?? true,

    // pricing from /api/products
    basePrice: product ? asNumber(product.price, null) : null,

    // placeholders
    qtyOnHand: 0,
    qtyAvailable: 0,
    qtyAllocated: 0,
    qtyOnOrder: 0,

    cost: null,

    upc: asString(part.upc),
    sku: key,
    internalPartNumber: key,

    raw: {
      part,
      product,
    },
  };
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("📦 Fetching ALL parts...");
    const parts = await fetchAllPages("/api/parts");

    console.log(`✅ Total parts: ${parts.length}`);

    console.log("💲 Fetching ALL products (pricing)...");
    const products = await fetchAllPages("/api/products");

    console.log(`✅ Total products: ${products.length}`);

    const productMap = buildProductMap(products);

    console.log("🔗 Merging parts + pricing...");

    const mapped = parts.map((p) => mapMerged(p, productMap));

    console.log("🧪 Sample merged:");
    console.log(JSON.stringify(mapped[0], null, 2));

    console.log("🚀 Running import...");

    const result = await runFishbowlProductImport(mapped);

    console.log("✅ IMPORT RESULT:");
    console.log(JSON.stringify(result, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

run();