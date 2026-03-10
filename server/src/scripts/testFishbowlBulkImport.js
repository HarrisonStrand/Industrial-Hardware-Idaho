import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import SyncRun from "../models/SyncRun.js";
import runFishbowlProductImport from "../services/catalog/runFishbowlProductImport.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Missing MONGO_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Cleanup prior test products
    await Product.deleteMany({
      sku: {
        $in: [
          "FB-BULK-001",
          "FB-BULK-002",
          "FB-BULK-003",
          "FB-BULK-BAD",
        ],
      },
    });

    const payloads = [
      {
        partId: "FB-BULK-1001",
        partNum: "FB-BULK-PART-001",
        sku: "FB-BULK-001",
        internalPartNumber: "IHI-BULK-001",
        uom: "ea",
        status: "Active",
        type: "Inventory",
        description: "Bulk test item 1",
        active: true,
        qtyOnHand: 25,
        qtyAvailable: 25,
        qtyAllocated: 0,
        qtyOnOrder: 10,
        cost: 0.25,
        basePrice: 0.95,
        currency: "USD",
        priceSource: "fishbowl",
        categoryHints: ["Fasteners"],
        searchKeywords: ["nut"],
      },
      {
        partId: "FB-BULK-1002",
        partNum: "FB-BULK-PART-002",
        sku: "FB-BULK-002",
        internalPartNumber: "IHI-BULK-002",
        uom: "ea",
        status: "Active",
        type: "Inventory",
        description: "Bulk test item 2",
        active: true,
        qtyOnHand: 40,
        qtyAvailable: 35,
        qtyAllocated: 5,
        qtyOnOrder: 0,
        cost: 0.75,
        basePrice: 2.25,
        currency: "USD",
        priceSource: "fishbowl",
        categoryHints: ["Fasteners", "Bolts"],
        searchKeywords: ["bolt", "hex"],
      },
      {
        partId: "FB-BULK-1003",
        partNum: "FB-BULK-PART-003",
        sku: "FB-BULK-003",
        internalPartNumber: "IHI-BULK-003",
        uom: "ea",
        status: "Active",
        type: "Inventory",
        description: "Bulk test item 3",
        active: true,
        qtyOnHand: 100,
        qtyAvailable: 92,
        qtyAllocated: 8,
        qtyOnOrder: 20,
        cost: 1.1,
        basePrice: 3.49,
        currency: "USD",
        priceSource: "fishbowl",
        categoryHints: ["Washers"],
        searchKeywords: ["washer", "flat"],
      },
      {
        // intentionally bad row to test error logging
        sku: "FB-BULK-BAD",
        description: "Bad item with no partId and no partNum",
      },
    ];

    const syncRun = await runFishbowlProductImport(payloads);

    const createdProducts = await Product.find({
      sku: { $in: ["FB-BULK-001", "FB-BULK-002", "FB-BULK-003", "FB-BULK-BAD"] },
    })
      .sort({ sku: 1 })
      .lean();

    const savedSyncRun = await SyncRun.findById(syncRun._id).lean();

    console.log("\n=== SYNC RUN RESULT ===");
    console.log(JSON.stringify(savedSyncRun, null, 2));

    console.log("\n=== CREATED/UPDATED PRODUCTS ===");
    console.log(JSON.stringify(createdProducts, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Bulk import test failed:", error);
    process.exit(1);
  }
}

run();