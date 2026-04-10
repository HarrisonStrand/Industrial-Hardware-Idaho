import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
// import VendorOffering from "../models/VendorOffering.js";

import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
// import createVendorOffering from "../services/catalog/createVendorOffering.js";
// import selectVendorOfferingForProduct from "../services/catalog/selectVendorOfferingForProduct.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await Product.findOne({ sku: "FB-SELECT-TEST-001" });

    if (existing) {
      await VendorOffering.deleteMany({ productId: existing._id });
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-SELECT-1001",
      partNum: "FB-SELECT-PART-001",
      sku: "FB-SELECT-TEST-001",
      internalPartNumber: "IHI-SELECT-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 3" Grade 5 Hex Bolt Zinc',
      active: true,
      qtyOnHand: 200,
      qtyAvailable: 180,
      qtyAllocated: 20,
      qtyOnOrder: 25,
      cost: 0.42,
      basePrice: 1.35,
      currency: "USD",
      priceSource: "fishbowl",
    });

    await Product.findByIdAndUpdate(upsertResult.product._id, {
      isCurated: true,
      needsReview: false,
    });

    await createProductEnrichmentFromProduct(upsertResult.product._id);

    await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Brighton Best",
      brandName: "Brighton Best",
      vendorPartNumber: "BB-SELECT-001",
      qtyAvailable: 40,
      qtyOnHand: 50,
      qtyOnOrder: 10,
      qtyAllocated: 10,
      cost: 0.41,
      price: 1.35,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 2,
      isPreferred: true,
      isSelectableByCustomer: false,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Preferred in-stock source",
    });

    await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Fastenal",
      brandName: "Fastenal",
      vendorPartNumber: "FAST-SELECT-001",
      qtyAvailable: 80,
      qtyOnHand: 80,
      qtyOnOrder: 0,
      qtyAllocated: 0,
      cost: 0.39,
      price: 1.35,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 3,
      isPreferred: false,
      isSelectableByCustomer: true,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Cheaper but not preferred",
    });

    await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Import",
      brandName: "Import",
      vendorPartNumber: "IMP-SELECT-001",
      qtyAvailable: 0,
      qtyOnHand: 0,
      qtyOnOrder: 100,
      qtyAllocated: 0,
      cost: 0.31,
      price: 1.35,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 7,
      isPreferred: false,
      isSelectableByCustomer: false,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Cheapest but out of stock",
    });

    const selection = await selectVendorOfferingForProduct(
      upsertResult.product._id
    );

    const offerings = await VendorOffering.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorName: 1 })
      .lean();

    console.log("\n=== OFFERINGS ===");
    console.log(JSON.stringify(offerings, null, 2));

    console.log("\n=== SELECTION RESULT ===");
    console.log(JSON.stringify(selection, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Vendor selection test failed:", error);
    process.exit(1);
  }
}

run();