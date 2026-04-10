import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import createProductEnrichmentFromProduct from "../services/catalog/createProductEnrichmentFromProduct.js";

dotenv.config();

async function run() {
	try {
		await mongoose.connect(process.env.MONGO_URI);

		const products = await Product.find({
			"fishbowl.raw.parsedAttributes.fastenerType": "Hex Bolt",
		}).limit(250);

		console.log(`Found ${products.length} hex bolt products`);

		let created = 0;
		let existing = 0;
		let failed = 0;

		for (const product of products) {
			try {
				const result = await createProductEnrichmentFromProduct(product._id);
				if (result.action === "created") created += 1;
				else existing += 1;
			} catch (err) {
				failed += 1;
				console.error(`Failed for ${product.sku}: ${err.message}`);
			}
		}

		console.log({ created, existing, failed });

		await mongoose.disconnect();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

run();