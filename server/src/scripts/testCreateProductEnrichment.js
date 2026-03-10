import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clean prior test record
    const existing = await Product.findOne({ sku: "FB-ENRICH-TEST-001" });
    if (existing) {
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    // Seed a realistic fastener product through the Fishbowl upsert path
    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-ENRICH-1001",
      partNum: "FB-ENRICH-PART-001",
      sku: "FB-ENRICH-TEST-001",
      internalPartNumber: "IHI-ENRICH-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      active: true,
      qtyOnHand: 60,
      qtyAvailable: 52,
      qtyAllocated: 8,
      qtyOnOrder: 10,
      cost: 0.88,
      basePrice: 2.45,
      currency: "USD",
      priceSource: "fishbowl",
    });

    console.log("\n--- PRODUCT AFTER UPSERT ---");
    console.log(JSON.stringify(upsertResult.product.toObject(), null, 2));

    // Mark curated to simulate selected catalog workflow
    await Product.findByIdAndUpdate(upsertResult.product._id, {
      isCurated: true,
      needsReview: false,
    });

    const enrichmentResult = await createProductEnrichmentFromProduct(
      upsertResult.product._id
    );

    const finalProduct = await Product.findById(upsertResult.product._id).lean();
    const finalEnrichment = await ProductEnrichment.findOne({
      productId: upsertResult.product._id,
    }).lean();

    console.log("\n--- ENRICHMENT RESULT ACTION ---");
    console.log(enrichmentResult.action);

    console.log("\n=== FINAL PRODUCT ===");
    console.log(JSON.stringify(finalProduct, null, 2));

    console.log("\n=== FINAL ENRICHMENT ===");
    console.log(JSON.stringify(finalEnrichment, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Create enrichment test failed:", error);
    process.exit(1);
  }
}

run();