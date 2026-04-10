import "dotenv/config";
import mongoose from "mongoose";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

async function main() {
	if (!process.env.MONGODB_URI) {
		throw new Error("MONGODB_URI is missing. Check your server .env file.");
	}

	await mongoose.connect(process.env.MONGODB_URI);
	const result = await runProductEnrichmentPass();
	console.log(JSON.stringify(result, null, 2));
	await mongoose.disconnect();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});