import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import VendorOffering from "../models/VendorOffering.js";
import VendorMapping from "../models/VendorMapping.js";

import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import attachStoredVendorImageToProduct from "../services/catalog/attachStoredVendorImageToProduct.js";
import markProductCurated from "../services/catalog/markProductCurated.js";
import markProductReadyForPublish from "../services/catalog/markProductReadyForPublish.js";
import publishProduct from "../services/catalog/publishProduct.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await Product.findOne({ sku: "FB-PUBLISH-TEST-001" });

    if (existing) {
      await VendorMapping.deleteMany({ productId: existing._id });
      await VendorOffering.deleteMany({ productId: existing._id });
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-PUBLISH-1001",
      partNum: "FB-PUBLISH-PART-001",
      sku: "FB-PUBLISH-TEST-001",
      internalPartNumber: "IHI-PUBLISH-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      active: true,
      qtyOnHand: 100,
      qtyAvailable: 90,
      qtyAllocated: 10,
      qtyOnOrder: 25,
      cost: 0.9,
      basePrice: 2.8,
      currency: "USD",
      priceSource: "fishbowl",
    });

    const productId = upsertResult.product._id;

    await markProductCurated(productId, { needsReview: false });
    await createProductEnrichmentFromProduct(productId);

    await attachStoredVendorImageToProduct({
      productId,
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg",
      vendorName: "Brighton Best",
      vendorPartNumber: "BB-PUBLISH-001",
    });

    const readinessBefore = await evaluateProductPublishReadiness(productId);
    const readyResult = await markProductReadyForPublish(productId);
    const publishResult = await publishProduct(productId);

    const finalProduct = await Product.findById(productId).lean();
    const finalEnrichment = await ProductEnrichment.findOne({ productId }).lean();

    console.log("\n=== READINESS BEFORE ===");
    console.log(JSON.stringify(readinessBefore, null, 2));

    console.log("\n=== READY RESULT ===");
    console.log(JSON.stringify(readyResult, null, 2));

    console.log("\n=== PUBLISH RESULT ===");
    console.log(JSON.stringify(publishResult, null, 2));

    console.log("\n=== FINAL PRODUCT ===");
    console.log(JSON.stringify(finalProduct, null, 2));

    console.log("\n=== FINAL ENRICHMENT ===");
    console.log(JSON.stringify(finalEnrichment, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Catalog publishing test failed:", error);
    process.exit(1);
  }
}

run();