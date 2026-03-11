import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import VendorOffering from "../models/VendorOffering.js";
import VendorMapping from "../models/VendorMapping.js";

import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import createVendorOffering from "../services/catalog/createVendorOffering.js";
import createVendorMapping from "../services/catalog/createVendorMapping.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await Product.findOne({ sku: "FB-MAP-TEST-001" });

    if (existing) {
      await VendorMapping.deleteMany({ productId: existing._id });
      await VendorOffering.deleteMany({ productId: existing._id });
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-MAP-1001",
      partNum: "FB-MAP-PART-001",
      sku: "FB-MAP-TEST-001",
      internalPartNumber: "IHI-MAP-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      active: true,
      qtyOnHand: 100,
      qtyAvailable: 90,
      qtyAllocated: 10,
      qtyOnOrder: 25,
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

    const brightonOfferingResult = await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Brighton Best",
      brandName: "Brighton Best",
      vendorPartNumber: "BB-516182-G8-YZ",
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
      isPreferred: true,
      isSelectableByCustomer: false,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Brighton supply option for mapping test.",
    });

    const fastenalOfferingResult = await createVendorOffering({
      productId: upsertResult.product._id,
      vendorName: "Fastenal",
      brandName: "Fastenal",
      vendorPartNumber: "FAST-516182-G8-YZ",
      vendorDescription: 'Fastenal source for 5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      vendorCategory: "Hex Bolts",
      qtyAvailable: 20,
      qtyOnHand: 20,
      qtyOnOrder: 0,
      qtyAllocated: 0,
      cost: 1.05,
      price: 2.95,
      currency: "USD",
      priceSource: "manual",
      leadTimeDays: 4,
      isPreferred: false,
      isSelectableByCustomer: true,
      approvalStatus: "approved",
      matchMethod: "manual",
      confidenceScore: 100,
      notes: "Fastenal alternate supply option for mapping test.",
    });

    const brightonMappingResult = await createVendorMapping({
      productId: upsertResult.product._id,
      vendorOfferingId: brightonOfferingResult.offering._id,
      vendorName: "Brighton Best",
      manufacturerName: "Brighton Best",
      vendorPartNumber: "BB-516182-G8-YZ",
      vendorAltPartNumbers: ["BB-LEGACY-516182-G8-YZ"],
      vendorCategory: "Hex Bolts",
      vendorDescription: 'Brighton catalog mapping for 5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      matchMethod: "manual",
      confidenceScore: 100,
      approved: true,
      needsReview: false,
      isPrimaryMapping: true,
      notes: "Primary Brighton mapping for this spec product.",
      feedData: {
        source: "manual-test",
        vendorFile: "brighton-test-catalog.csv",
      },
    });

    const fastenalMappingResult = await createVendorMapping({
      productId: upsertResult.product._id,
      vendorOfferingId: fastenalOfferingResult.offering._id,
      vendorName: "Fastenal",
      manufacturerName: "Fastenal",
      vendorPartNumber: "FAST-516182-G8-YZ",
      vendorCategory: "Hex Bolts",
      vendorDescription: 'Fastenal catalog mapping for 5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      matchMethod: "manual",
      confidenceScore: 100,
      approved: true,
      needsReview: false,
      isPrimaryMapping: true,
      notes: "Primary Fastenal mapping for this vendor.",
      feedData: {
        source: "manual-test",
        vendorFile: "fastenal-test-catalog.csv",
      },
    });

    const finalProduct = await Product.findById(upsertResult.product._id).lean();
    const finalEnrichment = await ProductEnrichment.findOne({
      productId: upsertResult.product._id,
    }).lean();
    const finalOfferings = await VendorOffering.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorName: 1 })
      .lean();
    const finalMappings = await VendorMapping.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorName: 1 })
      .lean();

    console.log("\n--- BRIGHTON MAPPING RESULT ---");
    console.log(brightonMappingResult.action);

    console.log("\n--- FASTENAL MAPPING RESULT ---");
    console.log(fastenalMappingResult.action);

    console.log("\n=== FINAL PRODUCT ===");
    console.log(JSON.stringify(finalProduct, null, 2));

    console.log("\n=== FINAL ENRICHMENT ===");
    console.log(JSON.stringify(finalEnrichment, null, 2));

    console.log("\n=== FINAL OFFERINGS ===");
    console.log(JSON.stringify(finalOfferings, null, 2));

    console.log("\n=== FINAL MAPPINGS ===");
    console.log(JSON.stringify(finalMappings, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Vendor mapping test failed:", error);
    process.exit(1);
  }
}

run();