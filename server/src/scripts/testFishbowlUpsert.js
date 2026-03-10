import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import upsertProductFromFishbowl from "../services/catalog/upsertProductFromFishbowl.js";

dotenv.config();

async function run() {
	try {
		if (!process.env.MONGO_URI) {
			throw new Error("Missing MONGO_URI in environment variables");
		}

		await mongoose.connect(process.env.MONGO_URI);
		console.log("Connected to MongoDB");

		// Cleanup this specific test product
		await Product.deleteMany({
			$or: [
				{ sku: "FB-UPSERT-TEST-001" },
				{ "fishbowl.partId": "FB-UP-1001" },
				{ "fishbowl.partNum": "FB-UP-PART-001" },
			],
		});

		console.log("\n--- FIRST UPSERT (CREATE) ---");
		const firstPayload = {
			partId: "FB-UP-1001",
			partNum: "FB-UP-PART-001",
			sku: "FB-UPSERT-TEST-001",
			internalPartNumber: "IHI-UPSERT-001",
			uom: "ea",
			status: "Active",
			type: "Inventory",
			description: "Initial Fishbowl import payload",
			active: true,
			qtyOnHand: 50,
			qtyAvailable: 45,
			qtyAllocated: 5,
			qtyOnOrder: 20,
			cost: 0.55,
			basePrice: 1.75,
			salePrice: null,
			currency: "USD",
			priceSource: "fishbowl",
			categoryHints: ["Fasteners"],
			searchKeywords: ["bolt", "hex"],
			raw: {
				source: "test-script",
				version: 1,
			},
		};

		const firstResult = await upsertProductFromFishbowl(firstPayload);
		console.log("Action:", firstResult.action);
		console.log(
			"Created Product:",
			JSON.stringify(firstResult.product.toObject(), null, 2),
		);

		// Simulate manual curation/enrichment work that should survive the next sync
		await Product.findByIdAndUpdate(firstResult.product._id, {
			isCurated: true,
			isPublished: false,
			catalogStatus: "enriched",
			hasEnrichment: true,
			hasImages: true,
			vendor: "Brighton Best",
			brand: "Brighton Best",
			needsReview: false,
		});

		console.log("\n--- SECOND UPSERT (UPDATE) ---");
		const secondPayload = {
			partId: "FB-UP-1001",
			partNum: "FB-UP-PART-001",
			sku: "FB-UPSERT-TEST-001",
			internalPartNumber: "IHI-UPSERT-001",
			uom: "ea",
			status: "Active",
			type: "Inventory",
			description: "Updated Fishbowl payload with new quantity",
			active: true,
			qtyOnHand: 80,
			qtyAvailable: 70,
			qtyAllocated: 10,
			qtyOnOrder: 15,
			cost: 0.6,
			basePrice: 1.95,
			salePrice: null,
			currency: "USD",
			priceSource: "fishbowl",
			categoryHints: ["Fasteners", "Bolts"],
			searchKeywords: ["bolt", "hex", "zinc"],
			raw: {
				source: "test-script",
				version: 2,
			},
		};

		const secondResult = await upsertProductFromFishbowl(secondPayload);
		console.log("Action:", secondResult.action);

		const finalProduct = await Product.findById(
			secondResult.product._id,
		).lean();

		console.log("\n=== FINAL PRODUCT AFTER UPDATE ===");
		console.log(JSON.stringify(finalProduct, null, 2));

		console.log("\nAssertions to verify manually:");
		console.log("- inventory and pricing should be updated");
		console.log("- fishbowl.description should be updated");
		console.log("- isCurated should still be true");
		console.log("- catalogStatus should still be enriched");
		console.log("- hasEnrichment should still be true");
		console.log("- hasImages should still be true");
		console.log("- vendor and brand should still be Brighton Best");

		process.exit(0);
	} catch (error) {
		console.error("Fishbowl upsert test failed:", error);
		process.exit(1);
	}
}

run();
