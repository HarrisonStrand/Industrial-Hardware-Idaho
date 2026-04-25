import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

function buildHexCapCandidateQuery() {
  return {
    $or: [
      { "fishbowl.partNum": /^MMCS/i },
      { "fishbowl.partNum": /CS/i },
      { "fishbowl.description": /hex cap screw|hex head bolt|hex bolt/i },
      { sku: /^MMCS/i },
      { sku: /CS/i },
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const products = await Product.find(
    buildHexCapCandidateQuery(),
    {
      _id: 1,
      sku: 1,
      "fishbowl.partNum": 1,
      "fishbowl.description": 1,
    }
  ).lean();

  const productIds = [...new Set(products.map((item) => String(item._id)))];
  console.log(`Found ${productIds.length} candidate hex-cap-screw products`);

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

  console.log("===== HEX CAP SCREW ENRICHMENT SUMMARY =====");
  console.log({
    totalProducts: productIds.length,
    ok,
    failed,
  });

  await mongoose.disconnect();
  console.log("✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Hex cap screw enrichment rerun failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
