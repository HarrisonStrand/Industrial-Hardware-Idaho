import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";

const BAD_PART_PATTERN = /(zz|void|delete)/i;
const TEST_PART_PATTERN = /^FB-/i;

function buildBadPartQuery() {
	return {
		$or: [
			{ "fishbowl.partNum": BAD_PART_PATTERN },
			{ sku: BAD_PART_PATTERN },
			{ internalPartNumber: BAD_PART_PATTERN },
			{ "fishbowl.partNum": TEST_PART_PATTERN },
			{ sku: TEST_PART_PATTERN },
			{ internalPartNumber: TEST_PART_PATTERN },
		],
	};
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const rows = await Product.find(buildBadPartQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
		isPublished: 1,
		catalogStatus: 1,
	})
		.sort({ "fishbowl.partNum": 1, sku: 1 })
		.lean();

	console.log(`Found ${rows.length} products matching delete pattern`);

	const preview = rows.slice(0, 200).map((row) => ({
		id: String(row._id),
		partNumber: row?.fishbowl?.partNum || "",
		sku: row?.sku || "",
		internalPartNumber: row?.internalPartNumber || "",
		description: row?.fishbowl?.description || "",
		isPublished: !!row?.isPublished,
		catalogStatus: row?.catalogStatus || "",
	}));

	console.log("===== DELETE PREVIEW =====");
	console.log(JSON.stringify(preview, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Preview failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
