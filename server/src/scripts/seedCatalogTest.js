import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import VendorMapping from "../models/VendorMapping.js";

dotenv.config();

async function run() {
	try {
		if (!process.env.MONGO_URI) {
			throw new Error("Missing MONGO_URI in environment variables");
		}

		await mongoose.connect(process.env.MONGO_URI);
		console.log("Connected to MongoDB");

		// Optional: clear prior test data for repeatable runs
		const existingProduct = await Product.findOne({ sku: "TEST-IHI-001" });

		if (existingProduct) {
			await ProductEnrichment.deleteMany({ productId: existingProduct._id });
			await VendorMapping.deleteMany({ productId: existingProduct._id });
			await Product.deleteOne({ _id: existingProduct._id });
		}

		const product = await Product.create({
			sku: "TEST-IHI-001",
			internalPartNumber: "IHI-TEST-001",
			fishbowl: {
				partId: "FB-PART-1001",
				partNum: "FB-001-TEST",
				uom: "ea",
				status: "Active",
				type: "Inventory",
				description: "Test Fishbowl product for schema validation",
				active: true,
				raw: {
					source: "manual-seed",
					note: "Testing product schema before real Fishbowl sync",
				},
				lastSyncedAt: new Date(),
			},
			vendor: "",
			brand: "",
			inventory: {
				qtyOnHand: 120,
				qtyAvailable: 100,
				qtyAllocated: 20,
				qtyOnOrder: 50,
				lastSyncedAt: new Date(),
			},
			pricing: {
				cost: 0.42,
				basePrice: 1.25,
				salePrice: null,
				currency: "USD",
				priceSource: "manual",
				lastSyncedAt: new Date(),
			},
			isActive: true,
			isPublished: false,
			isCurated: true,
			catalogStatus: "draft",
			hasEnrichment: false,
			hasImages: false,
			needsReview: true,
			categoryHints: ["Fasteners", "Bolts"],
			searchKeywords: ["brighton", "hex bolt", "test item"],
			sourceHashes: {
				fishbowlHash: "",
				inventoryHash: "",
				pricingHash: "",
			},
		});

		console.log("Created Product:", product._id.toString());

		const enrichment = await ProductEnrichment.create({
			productId: product._id,
			title: '1/4"-20 Zinc Plated Hex Bolt',
			shortTitle: '1/4"-20 Hex Bolt',
			description:
				"This is a seeded test enrichment record for validating the product enrichment schema and relationships.",
			shortDescription: "Seeded test enrichment record.",
			bulletPoints: ['Size: 1/4"-20', "Finish: Zinc Plated", "Type: Hex Bolt"],
			websiteBrand: "Brighton Best",
			websiteVendor: "Brighton Best",
			category: "Fasteners",
			subcategory: "Hex Bolts",
			tags: ["brighton-best", "hex-bolt", "zinc", "curated-test"],
			attributes: {
				size: '1/4"-20',
				material: "Steel",
				finish: "Zinc Plated",
				fastenerType: "Hex Bolt",
				threadType: "Coarse",
			},
			images: [
				{
					url: "https://example.com/test-image-1.jpg",
					alt: '1/4"-20 Zinc Plated Hex Bolt',
					sortOrder: 0,
					source: "manual",
					sourceVendor: "Brighton Best",
					sourcePartNumber: "BB-TEST-001",
					isPrimary: true,
					needsReview: true,
					cleaned: false,
					backgroundRemoved: false,
				},
			],
			seo: {
				slug: "1-4-20-zinc-plated-hex-bolt-test",
				metaTitle: '1/4"-20 Zinc Plated Hex Bolt | Test Product',
				metaDescription:
					"Seeded test product used to validate catalog enrichment structure.",
				keywords: ["hex bolt", "zinc plated", "brighton best", "test product"],
				canonicalUrl: "",
			},
			merchandising: {
				badge: "Test",
				featured: false,
				sortOrder: 0,
				collectionTags: ["test-collection"],
			},
			contentStatus: "partially-written",
			imageStatus: "matched",
			overrideFlags: {
				lockTitle: false,
				lockDescription: false,
				lockImages: false,
				lockCategory: false,
			},
			notes: "Seeded manually to test enrichment relationships.",
		});

		console.log("Created ProductEnrichment:", enrichment._id.toString());

		const mapping = await VendorMapping.create({
			productId: product._id,
			vendorName: "Brighton Best",
			manufacturerName: "Brighton Best",
			internalPartNumber: "IHI-TEST-001",
			websiteSku: "TEST-IHI-001",
			fishbowlPartNum: "FB-001-TEST",
			vendorPartNumber: "BB-TEST-001",
			vendorAltPartNumbers: ["BB-LEGACY-001"],
			matchMethod: "manual",
			confidenceScore: 100,
			vendorCategory: "Hex Bolts",
			vendorDescription: "Vendor test mapping record",
			feedData: {
				importedFrom: "manual-seed",
				note: "Testing Brighton mapping structure",
			},
			approved: true,
			needsReview: false,
		});

		console.log("Created VendorMapping:", mapping._id.toString());

		await Product.findByIdAndUpdate(product._id, {
			enrichmentId: enrichment._id,
			hasEnrichment: true,
			hasImages: true,
			vendor: "Brighton Best",
			brand: "Brighton Best",
			catalogStatus: "enriched",
			needsReview: false,
		});

		const finalProduct = await Product.findById(product._id).lean();
		const finalEnrichment = await ProductEnrichment.findOne({
			productId: product._id,
		}).lean();
		const finalMapping = await VendorMapping.findOne({
			productId: product._id,
			vendorName: "Brighton Best",
		}).lean();

		console.log("\n=== FINAL SEEDED RECORDS ===");
		console.log("Product:", JSON.stringify(finalProduct, null, 2));
		console.log("Enrichment:", JSON.stringify(finalEnrichment, null, 2));
		console.log("Vendor Mapping:", JSON.stringify(finalMapping, null, 2));

		console.log("\nSeed test completed successfully.");
		process.exit(0);
	} catch (error) {
		console.error("Seed test failed:", error);
		process.exit(1);
	}
}

run();
