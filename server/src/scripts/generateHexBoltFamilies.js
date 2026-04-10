import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

dotenv.config();

async function run() {
	try {
		await mongoose.connect(process.env.MONGO_URI);

		console.log("🔍 Finding hex bolt products...");

		const products = await Product.find({
			"fishbowl.raw.parsedAttributes.fastenerType": "Hex Bolt",
			isActive: true,
		}).select("_id");

		const productIds = products.map((p) => p._id);

		console.log(`Found ${productIds.length} hex bolt products`);

		console.log("🚀 Running family generation...");

		const result = await runProductEnrichmentPass({
			productIds,
			dryRun: false,
		});

		console.log("✅ RESULT:");
		console.log(JSON.stringify(result, null, 2));

		await mongoose.disconnect();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

run();