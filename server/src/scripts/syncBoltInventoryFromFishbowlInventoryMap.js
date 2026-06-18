import "../config/env.js";
import mongoose from "mongoose";

import { runFishbowlInventoryMapSync } from "../services/fishbowl/syncFishbowlInventoryMap.js";

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const samples = hasFlag("samples");
  const setMissingZero = hasFlag("set-missing-zero");

  const limit = Number(argValue("limit", "0")) || 0;
  const inventoryPageSize = Number(argValue("inventory-page-size", "100")) || 100;
  const inventoryPageLimit = Number(argValue("inventory-page-limit", "0")) || 0;
  const inventoryPath = clean(argValue("inventory-path", "/api/parts/inventory"));
  const partField = clean(argValue("part-field", "partNumber"));
  const qtyField = clean(argValue("qty-field", "quantity"));
  const category = clean(argValue("category", "bolts"));
  const partNumber = clean(argValue("part", ""));

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
        pageSize: inventoryPageSize,
        pageLimit: inventoryPageLimit || "all",
        partField,
        qtyField,
      },
      null,
      2,
    ),
  );

  const result = await runFishbowlInventoryMapSync({
    dryRun,
    samples,
    setMissingZero,
    limit,
    inventoryPageSize,
    inventoryPageLimit,
    inventoryPath,
    partField,
    qtyField,
    category,
    partNumber,
    triggeredBy: "script",
    persistRun: true,
  });

  console.log("===== FISHBOWL INVENTORY MAP SUMMARY =====");
  console.log(JSON.stringify(result.inventorySummary, null, 2));
  console.log(
    JSON.stringify(
      {
        uniqueMappedPartNumbers: result.uniqueMappedPartNumbers,
      },
      null,
      2,
    ),
  );

  if (samples) {
    console.log("===== FISHBOWL INVENTORY MAP SAMPLES =====");
    console.log(JSON.stringify(result.inventorySamples, null, 2));
  }

  console.log("===== BOLT INVENTORY MAP SYNC SUMMARY =====");
  console.log(JSON.stringify(result.syncSummary, null, 2));

  if (samples) {
    console.log("===== SYNC SAMPLES =====");
    console.log(JSON.stringify(result.syncSamples, null, 2));
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
