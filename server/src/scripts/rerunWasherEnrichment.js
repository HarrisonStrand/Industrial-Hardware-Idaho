// server/src/scripts/rerunWasherEnrichment.js
import "../config/env.js";
import mongoose from "mongoose";

import ProductEnrichment from "../models/ProductEnrichment.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const enrichments = await ProductEnrichment.find(
    {
      $or: [
        { category: "washers" },
        { subcategory: /washer/i },
        { "attributes.familyType": /washer/i },
        { title: /washer/i },
        { "attributes.fishbowlDescription": /washer/i },
      ],
    },
    { productId: 1, category: 1, subcategory: 1, title: 1 }
  ).lean();

  const productIds = [...new Set(enrichments.map((item) => String(item.productId)))];

  console.log(`Found ${productIds.length} washer-related products`);

  const chunkSize = 250;
  let processed = 0;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);

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
      `Processed ${processed}/${productIds.length} | ok=${ok} | failed=${failed}`
    );

    if (chunkFailed > 0) {
      console.log(
        "Sample failures:",
        result.results.filter((r) => r.status === "failed").slice(0, 5)
      );
    }
  }

  console.log("===== WASHER ENRICHMENT SUMMARY =====");
  console.log({
    totalProducts: productIds.length,
    ok,
    failed,
  });

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Washer enrichment rerun failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});