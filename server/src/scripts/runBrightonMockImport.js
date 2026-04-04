import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";

import runVendorCatalogImport from "../services/vendor-import/runVendorCatalogImport.js";
import normalizeBrightonRow from "../services/vendor-import/brighton/normalizeBrightonRow.js";
import matchBrightonRowToProduct from "../services/vendor-import/brighton/matchBrightonRowToProduct.js";

dotenv.config();

async function loadCsvRows(filePath) {
  const absolutePath = path.resolve(filePath);
  const csvText = await fs.readFile(absolutePath, "utf8");

  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

async function run() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    const filePath = "data/brighton-mock.csv";
    console.log(`📄 Loading CSV: ${filePath}`);

    const rows = await loadCsvRows(filePath);
    console.log(`✅ Loaded ${rows.length} mock Brighton rows`);

    console.log("🚀 Running Brighton mock import...");

    const result = await runVendorCatalogImport({
      vendorName: "Brighton Best",
      rows,
      normalizeRow: normalizeBrightonRow,
      matchRowToProduct: matchBrightonRowToProduct,
    });

    console.log("✅ IMPORT RESULT:");
    console.log(JSON.stringify(result.syncRun, null, 2));

    console.log("\n🧪 RESULT SAMPLE:");
    console.log(JSON.stringify(result.results.slice(0, 10), null, 2));

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

run();