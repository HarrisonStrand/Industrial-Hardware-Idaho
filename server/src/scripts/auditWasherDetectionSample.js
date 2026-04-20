// server/src/scripts/auditWasherDetectionSample.js
import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import detectProductFamilyFromDescription from "../services/catalog/detectProductFamilyFromDescription.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connected");

  const limit = Number(process.env.WASHER_SAMPLE_SIZE || 50);

  const products = await Product.find(
    {
      $or: [
        { "fishbowl.description": /washer/i },
        { sku: /washer/i },
        { vendor: /washer/i },
      ],
    },
    {
      sku: 1,
      vendor: 1,
      brand: 1,
      fishbowl: 1,
    }
  )
    .limit(limit)
    .lean();

  console.log(`Found ${products.length} washer sample products\n`);

  for (const product of products) {
    const parsed = product?.fishbowl?.raw?.parsedAttributes || {};
    const detected = detectProductFamilyFromDescription({
      product,
      parsed,
    });

    console.log("==================================================");
    console.log("SKU:", product?.sku || "");
    console.log("Part Number:", product?.fishbowl?.partNum || "");
    console.log("Description:", product?.fishbowl?.description || "");
    console.log("Parsed:", parsed);
    console.log("Detected:", {
      category: detected.category,
      subcategory: detected.subcategory,
      familyType: detected.familyType,
      washerStandard: detected.washerStandard,
      size: detected.size,
      diameter: detected.diameter,
      insideDiameter: detected.insideDiameter,
      outsideDiameter: detected.outsideDiameter,
      thickness: detected.thickness,
      finish: detected.finish,
      material: detected.material,
      measurementSystem: detected.measurementSystem,
      familyKey: detected.familyKey,
      familyTitle: detected.familyTitle,
    });
  }

  await mongoose.disconnect();
  console.log("\n✅ Done");
}

main().catch(async (err) => {
  console.error("❌ Washer audit failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});