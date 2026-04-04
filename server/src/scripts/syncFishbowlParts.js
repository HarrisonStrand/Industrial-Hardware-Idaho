import dotenv from "dotenv";
import mongoose from "mongoose";
import { fishbowlClient } from "../integrations/fishbowl/fishbowlClient.js";
import runFishbowlProductImport from "../services/catalog/runFishbowlProductImport.js";

dotenv.config();

function asString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function mapFishbowlPartToImportShape(part = {}) {
  return {
    partId: part.id,
    partNum: asString(part.number),
    description: asString(part.description),
    type: asString(part.type),
    uom: asString(part?.uom?.name || part?.uom?.abbreviation || ""),
    active: typeof part.active === "boolean" ? part.active : true,

    // placeholders for fields your Product pipeline supports
    qtyOnHand: asNumber(part.qtyOnHand, 0),
    qtyAvailable: asNumber(part.qtyAvailable, 0),
    qtyAllocated: asNumber(part.qtyAllocated, 0),
    qtyOnOrder: asNumber(part.qtyOnOrder, 0),

    cost:
      part.cost === null || part.cost === undefined
        ? null
        : asNumber(part.cost, 0),

    basePrice:
      part.basePrice === null || part.basePrice === undefined
        ? null
        : asNumber(part.basePrice, 0),

    salePrice:
      part.salePrice === null || part.salePrice === undefined
        ? null
        : asNumber(part.salePrice, 0),

    upc: asString(part.upc),
    sku: asString(part.number),
    internalPartNumber: asString(part.number),

    raw: part,
  };
}

async function fetchAllParts() {
  const response = await fishbowlClient.request({
    method: "GET",
    path: "/api/parts",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Fishbowl parts: ${response.status} ${JSON.stringify(response.data)}`
    );
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }

  if (Array.isArray(response.data?.parts)) {
    return response.data.parts;
  }

  throw new Error(
    `Unexpected Fishbowl parts response shape: ${JSON.stringify(
      Object.keys(response.data || {})
    )}`
  );
}

async function run() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    console.log("📦 Fetching Fishbowl parts...");
    const parts = await fetchAllParts();

    console.log(`✅ Retrieved ${parts.length} Fishbowl parts`);

    const mappedParts = parts.map(mapFishbowlPartToImportShape);

    console.log("🧪 Sample mapped part:");
    console.log(JSON.stringify(mappedParts[0], null, 2));

    console.log("🚀 Running Fishbowl product import...");
    const result = await runFishbowlProductImport(mappedParts);

    console.log("✅ IMPORT RESULT:");
    console.log(JSON.stringify(result, null, 2));

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

run();