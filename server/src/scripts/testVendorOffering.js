import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import VendorOffering from "../models/VendorOffering.js";
import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import createVendorOffering from "../services/catalog/createVendorOffering.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await Product.findOne({ sku: "FB-VENDOR-TEST-001" });

    if (existing) {
      await VendorOffering.deleteMany({ productId: existing._id });
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-VENDOR-1001",
      partNum: "FB-VENDOR-PART-001",
      sku: "FB-VENDOR-TEST-001",
      internalPartNumber: "IHI-VENDOR-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      active: true,
      qtyOnHand: 100,
      qtyAvailable: 85,
      qtyAllocated: 15,
      qtyOnOrder: 30,
      cost: 0.92,
      basePrice: 2.75,
      currency: "USD",
      priceSource: "fishbowl",
    });

    await Product.findByIdAndUpdate(upsertResult.product._id, {
      isCurated: true,
      needsReview: false,
    });

    await createProductEnrichmentFromProduct(upsertResult.product._id);

    const brightonResult = await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Brighton Best",
      brandName: "Brighton Best",
      vendorPartNumber: "BB-516182-G8-YZ",
      vendorAltPartNumbers: ["BB-ALT-001"],
      vendorDescription: 'Brighton source for 5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      vendorCategory: "Hex Bolts",
      qtyAvailable: 40,
      qtyOnHand: 50,
      qtyOnOrder: 20,
      qtyAllocated: 10,
      cost: 0.88,
      price: 2.75,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 2,
      minOrderQty: 1,
      packQty: 1,
      isPreferred: true,
      isSelectableByCustomer: false,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Primary source for this test item.",
      feedData: {
        source: "manual-test",
      },
    });

    const alternateResult = await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Fastenal",
      brandName: "Fastenal",
      vendorPartNumber: "FAST-516182-G8-YZ",
      vendorDescription: 'Fastenal source for 5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      vendorCategory: "Hex Bolts",
      qtyAvailable: 25,
      qtyOnHand: 25,
      qtyOnOrder: 0,
      qtyAllocated: 0,
      cost: 1.05,
      price: 2.95,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 4,
      minOrderQty: 1,
      packQty: 1,
      isPreferred: false,
      isSelectableByCustomer: true,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Alternate selectable source for this test item.",
      feedData: {
        source: "manual-test",
      },
    });

    const finalProduct = await Product.findById(upsertResult.product._id).lean();
    const enrichment = await ProductEnrichment.findOne({
      productId: upsertResult.product._id,
    }).lean();
    const offerings = await VendorOffering.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorName: 1 })
      .lean();

    console.log("\n--- BRIGHTON RESULT ---");
    console.log(brightonResult.action);

    console.log("\n--- ALTERNATE RESULT ---");
    console.log(alternateResult.action);

    console.log("\n=== FINAL PRODUCT ===");
    console.log(JSON.stringify(finalProduct, null, 2));

    console.log("\n=== ENRICHMENT ===");
    console.log(JSON.stringify(enrichment, null, 2));

    console.log("\n=== VENDOR OFFERINGS ===");
    console.log(JSON.stringify(offerings, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Vendor offering test failed:", error);
    process.exit(1);
  }
}

run();