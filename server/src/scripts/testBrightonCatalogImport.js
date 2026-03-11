import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import VendorOffering from "../models/VendorOffering.js";
import VendorMapping from "../models/VendorMapping.js";
import SyncRun from "../models/SyncRun.js";

import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";
import runVendorCatalogImport from "../services/vendor-import/runVendorCatalogImport.js";
import normalizeBrightonRow from "../services/vendor-import/brighton/normalizeBrightonRow.js";
import matchBrightonRowToProduct from "../services/vendor-import/brighton/matchBrightonRowToProduct.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clean current test product and all related records
    const existing = await Product.findOne({ sku: "FB-BRIGHTON-TEST-001" });

    if (existing) {
      await VendorMapping.deleteMany({ productId: existing._id });
      await VendorOffering.deleteMany({ productId: existing._id });
      await ProductEnrichment.deleteMany({ productId: existing._id });
      await Product.deleteOne({ _id: existing._id });
    }

    // Clean any leftover Brighton test rows from prior runs that could hijack matching
    await VendorMapping.deleteMany({
      vendorName: "Brighton Best",
      vendorPartNumber: {
        $in: ["BB-516182-G8-YZ", "BB-UNKNOWN-001"],
      },
    });

    await VendorOffering.deleteMany({
      vendorName: "Brighton Best",
      vendorPartNumber: {
        $in: ["BB-516182-G8-YZ", "BB-UNKNOWN-001"],
      },
    });

    await SyncRun.deleteMany({ jobType: "vendor-brighton-import" });

    // Seed one Fishbowl-backed product that Brighton should match to
    const upsertResult = await upsertProductFromFishbowl({
      partId: "FB-BRIGHTON-1001",
      partNum: "FB-BRIGHTON-PART-001",
      sku: "FB-BRIGHTON-TEST-001",
      internalPartNumber: "IHI-BRIGHTON-001",
      uom: "ea",
      status: "Active",
      type: "Inventory",
      description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
      active: true,
      qtyOnHand: 120,
      qtyAvailable: 100,
      qtyAllocated: 20,
      qtyOnOrder: 40,
      cost: 0.9,
      basePrice: 2.8,
      currency: "USD",
      priceSource: "fishbowl",
    });

    await Product.findByIdAndUpdate(upsertResult.product._id, {
      isCurated: true,
      needsReview: false,
    });

    await createProductEnrichmentFromProduct(upsertResult.product._id);

    // Two Brighton rows:
    // 1) should match the seeded product
    // 2) should stay unmatched / review
const brightonRows = [
  {
    partNumber: "BB-516182-G8-YZ",
    description: '5/16-18 x 2" Grade 8 Hex Bolt Yellow Zinc',
    category: "Hex Bolts",
    internalPartNumber: "IHI-BRIGHTON-001",
    websiteSku: "FB-BRIGHTON-TEST-001",
    available: 45,
    onHand: 50,
    onOrder: 20,
    allocated: 5,
    cost: 0.87,
    price: 2.79,
    currency: "USD",
    leadTimeDays: 2,
    imageUrl: "https://example.com/brighton-516182-g8-yz.jpg",
  },
  {
    partNumber: "BB-UNKNOWN-001",
    description: '7/8-9 x 6" Heavy Hex Bolt Plain',
    category: "Hex Bolts",
    available: 12,
    onHand: 12,
    onOrder: 0,
    allocated: 0,
    cost: 3.2,
    price: 7.5,
    currency: "USD",
    leadTimeDays: 3,
    imageUrl: "https://example.com/brighton-unknown.jpg",
  },
];

    const importResult = await runVendorCatalogImport({
      vendorName: "Brighton Best",
      rows: brightonRows,
      normalizeRow: normalizeBrightonRow,
      matchRowToProduct: matchBrightonRowToProduct,
    });

    const finalProduct = await Product.findById(upsertResult.product._id).lean();

    const finalOfferings = await VendorOffering.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorPartNumber: 1 })
      .lean();

    const finalMappings = await VendorMapping.find({
      productId: upsertResult.product._id,
    })
      .sort({ vendorPartNumber: 1 })
      .lean();

    const finalSyncRuns = await SyncRun.find({
      jobType: "vendor-brighton-import",
    })
      .sort({ createdAt: -1 })
      .lean();

    console.log("\n=== IMPORT RESULT ===");
    console.log(JSON.stringify(importResult.results, null, 2));

    console.log("\n=== FINAL PRODUCT ===");
    console.log(JSON.stringify(finalProduct, null, 2));

    console.log("\n=== FINAL OFFERINGS ===");
    console.log(JSON.stringify(finalOfferings, null, 2));

    console.log("\n=== FINAL MAPPINGS ===");
    console.log(JSON.stringify(finalMappings, null, 2));

    console.log("\n=== FINAL SYNC RUNS ===");
    console.log(JSON.stringify(finalSyncRuns, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Brighton catalog import test failed:", error);
    process.exit(1);
  }
}

run();