// server/src/scripts/runFullEnrichmentAndReviewBackfill.js
import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const totalProducts = await Product.countDocuments({});
  console.log(`Found ${totalProducts} total products`);

  const sampleSize = Number(process.env.ENRICHMENT_SAMPLE_SIZE || 0);

  let targetIds = [];
  if (sampleSize > 0) {
    const sampleProducts = await Product.find({}, { _id: 1 })
      .sort({ createdAt: -1 })
      .limit(sampleSize)
      .lean();

    targetIds = sampleProducts.map((p) => p._id);
    console.log(`Running sample enrichment pass for ${targetIds.length} products`);
  } else {
    const allProducts = await Product.find({}, { _id: 1 }).lean();
    targetIds = allProducts.map((p) => p._id);
    console.log(`Running full enrichment pass for ${targetIds.length} products`);
  }

  let processed = 0;
  let ok = 0;
  let failed = 0;

  const chunkSize = 100;

  for (let i = 0; i < targetIds.length; i += chunkSize) {
    const chunk = targetIds.slice(i, i + chunkSize);

    const result = await runProductEnrichmentPass({
      productIds: chunk,
      dryRun: false,
    });

    const chunkOk = result.results.filter((r) => r.status === "ok").length;
    const chunkFailed = result.results.filter((r) => r.status === "failed").length;

    processed += chunk.length;
    ok += chunkOk;
    failed += chunkFailed;

    console.log(
      `Processed ${processed}/${targetIds.length} | ok=${ok} | failed=${failed} | families=${result.familyCount}`
    );

    if (chunkFailed > 0) {
      const sampleFailures = result.results
        .filter((r) => r.status === "failed")
        .slice(0, 5);

      console.log("Sample failures:", sampleFailures);
    }
  }

  console.log("\n===== ENRICHMENT PASS SUMMARY =====");
  console.log({
    totalProducts: targetIds.length,
    ok,
    failed,
  });

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Script failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});