import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductEnrichment from "../models/ProductEnrichment.js";

dotenv.config();

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function shouldNormalizeHexBolt(enrichment) {
	const category = clean(enrichment.category);
	const subcategory = clean(enrichment.subcategory);
	const attrs = enrichment.attributes || {};
	const fastenerType = clean(attrs.fastenerType);

	const categoryMatch = category === "fasteners" || category === "bolts";
	const subcategoryMatch =
		subcategory === "hex bolts" ||
		subcategory === "hex bolt" ||
		subcategory === "hex head bolts" ||
		subcategory === "hex head bolt";

	const fastenerTypeMatch = fastenerType === "hex bolt";

	return categoryMatch && (subcategoryMatch || fastenerTypeMatch);
}

async function run() {
	try {
		await mongoose.connect(process.env.MONGO_URI);

		const enrichments = await ProductEnrichment.find({});

		let updated = 0;
		let skipped = 0;

		for (const enrichment of enrichments) {
			if (!shouldNormalizeHexBolt(enrichment)) {
				skipped += 1;
				continue;
			}

			enrichment.category = "bolts";
			enrichment.subcategory = "hex cap screws";

			await enrichment.save();
			updated += 1;
		}

		console.log("✅ TAXONOMY MIGRATION COMPLETE");
		console.log({ updated, skipped });

		await mongoose.disconnect();
	} catch (err) {
		console.error("❌ ERROR:", err.message);
		process.exit(1);
	}
}

run();