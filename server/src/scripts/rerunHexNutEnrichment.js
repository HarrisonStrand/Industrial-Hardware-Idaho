import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

const HEX_NUT_PART_PATTERN = /^\s*(?:HN[258][CF]\d{3}(?:P|PL)?|SSHN\d{3}(?:[CF])?|MMHN\d{5}(?:SS|P)?|HHN\d{3}(?:[CF])?)\s*$/i;

function argValue(name, fallback = "") {
	const prefix = `--${name}=`;
	const found = process.argv.find((arg) => arg.startsWith(prefix));
	return found ? found.slice(prefix.length).trim() : fallback;
}

function buildHexNutCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": HEX_NUT_PART_PATTERN },
					{ sku: HEX_NUT_PART_PATTERN },
					{ internalPartNumber: HEX_NUT_PART_PATTERN },
					{ "fishbowl.description": /\b(?:finished?\s+)?hex\s+nut(s)?\b/i },
					{ "fishbowl.description": /\bheavy\s+hex\s+nut(s)?\b/i },
					{ "fishbowl.description": /\bnut\b.*\bhex\b/i },
					{ "fishbowl.raw.parsedAttributes.fastenerType": /hex nut/i },
				],
			},
			{
				$nor: [
					{ "fishbowl.description": /locknut assy|assembly|assy|kit|assortment/i },
					{ "fishbowl.description": /lock\s*nut|locknut|nylock|nylon insert/i },
					{ "fishbowl.description": /coupling nut|wing nut|acorn nut|cap nut/i },
					{ "fishbowl.description": /flange nut|castle nut|square nut|tee nut|t-nut|weld nut|rivet nut|push nut/i },
				],
			},
		],
	};
}

async function main() {
	console.time("hexNutEnrichment");

	const limit = Math.max(0, Number(argValue("limit", "0")) || 0);

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	let query = Product.find(buildHexNutCandidateQuery(), {
		_id: 1,
		sku: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
	}).sort({ "fishbowl.partNum": 1, sku: 1 });

	if (limit) query = query.limit(limit);

	const products = await query.lean();
	const productIds = [...new Set(products.map((item) => String(item._id)))];

	console.log(
		`Found ${productIds.length} hex nut candidate product${productIds.length === 1 ? "" : "s"}${
			limit ? ` with limit=${limit}` : ""
		}`,
	);

	const chunkSize = 250;
	let processed = 0;
	let ok = 0;
	let failed = 0;
	let created = 0;
	let updated = 0;

	for (let i = 0; i < productIds.length; i += chunkSize) {
		const chunk = productIds.slice(i, i + chunkSize);
		const result = await runProductEnrichmentPass({ productIds: chunk, dryRun: false });

		const chunkOk = result.results.filter((item) => item.status === "ok").length;
		const chunkFailed = result.results.filter((item) => item.status === "failed").length;
		const chunkCreated = result.results.filter((item) => item.action === "created").length;
		const chunkUpdated = result.results.filter((item) => item.action === "updated").length;

		processed += chunk.length;
		ok += chunkOk;
		failed += chunkFailed;
		created += chunkCreated;
		updated += chunkUpdated;

		console.log(
			`Processed ${processed}/${productIds.length} | ok=${ok} | failed=${failed} | created=${created} | updated=${updated}`,
		);

		if (chunkFailed > 0) {
			console.log(
				"Sample failures:",
				result.results.filter((item) => item.status === "failed").slice(0, 10),
			);
		}
	}

	console.log("===== HEX NUT ENRICHMENT SUMMARY =====");
	console.log({ totalProducts: productIds.length, ok, failed, created, updated });

	await mongoose.disconnect();
	console.log("✅ Done");
	console.timeEnd("hexNutEnrichment");
}

main().catch(async (err) => {
	console.error("❌ Hex nut enrichment failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
