import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import runProductEnrichmentPass from "../services/catalog/runProductEnrichmentPass.js";

function buildHexCapCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": /^MMCS/i },
					{
						"fishbowl.partNum":
							/^(?:SS|HH|SB|AN|AL|BR)?CS\d[CF]\d{2,3}\d{4}(?:P|T|TAP)?$/i,
					},
					{
						"fishbowl.description":
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\btap bolt\b|\bc\/s\b/i,
					},
					{ sku: /^MMCS/i },
					{
						sku: /^(?:SS|HH|SB|AN|AL|BR)?CS\d[CF]\d{2,3}\d{4}(?:P|T|TAP)?$/i,
					},
					{
						"fishbowl.description":
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\bheavy hex bolt\b|\bstructural bolt\b|\ba307\b|\ba325\b|\btap bolt\b|\bc\/s\b/i,
					},
				],
			},
			{
				$nor: [
					{
						"fishbowl.description":
							/assembly| assy|locknut assy| w\/ | with locknut/i,
					},
					{ "fishbowl.partNum": /^CHCS/i },
					{ sku: /^CHCS/i },
					{
						"fishbowl.description": /socket head cap screw|soc\.?hd\.?c\/s/i,
					},
					{ "fishbowl.description": /spacer assortment/i },
					{ "fishbowl.description": /auveco/i },
					{ sku: /auveco/i },
					{ "fishbowl.partNum": /auveco/i },
					{ "fishbowl.description": /specialty hardware/i },
					{ "fishbowl.description": /countersink|combo drill/i },
					{ sku: /^CS\d+\s*T/i },
					{ "fishbowl.partNum": /^CS\d+\s*T/i },
					{ sku: /^BA/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{
						"fishbowl.description":
							/\bassy\b|\bassembly\b|\bkit\b|\bassortment\b/i,
					},
					{ "fishbowl.description": /\bauto assortment\b/i },
					{ "fishbowl.partNum": /^BA/i },
					{ "fishbowl.partNum": /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ sku: /^(91251A694|91280A964|91465A212|93395A316|940396)$/i },
					{ "fishbowl.partNum": /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ sku: /^(Anixter Bolt Assembly|IVVC BOLT ASSY)$/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{ "fishbowl.partNum": /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },
					{ sku: /^SSCS\d{3,4}\d{4}C(?:\s*TAP)?$/i },

					{ sku: /^BA/i },
					{ "fishbowl.partNum": /^SSCSFT/i },
					{ sku: /^SSCSFT/i },
					{
						"fishbowl.description":
							/\bassy\b|\bassembly\b|\bkit\b|\bassortment\b|\bauto assortment\b/i,
					},
					{ "fishbowl.description": /countersink|combo drill/i },
					{ "fishbowl.description": /socket head cap screw|soc\.?hd\.?c\/s/i },
				],
			},
		],
	};
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(buildHexCapCandidateQuery(), {
		_id: 1,
		sku: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
	}).lean();

	const productIds = [...new Set(products.map((item) => String(item._id)))];
	console.log(`Found ${productIds.length} candidate hex-cap-screw products`);

	const chunkSize = 250;
	let processed = 0;
	let ok = 0;
	let failed = 0;

	for (let i = 0; i < productIds.length; i += chunkSize) {
		const chunk = productIds.slice(i, i + chunkSize);

		const result = await runProductEnrichmentPass({
			productIds: chunk,
			dryRun: false,
		});

		const chunkOk = result.results.filter((r) => r.status === "ok").length;
		const chunkFailed = result.results.filter(
			(r) => r.status === "failed",
		).length;

		processed += chunk.length;
		ok += chunkOk;
		failed += chunkFailed;

		console.log(
			`Processed ${processed}/${productIds.length} | ok=${ok} | failed=${failed}`,
		);

		if (chunkFailed > 0) {
			console.log(
				"Sample failures:",
				result.results.filter((r) => r.status === "failed").slice(0, 5),
			);
		}
	}

	console.log("===== HEX CAP SCREW ENRICHMENT SUMMARY =====");
	console.log({
		totalProducts: productIds.length,
		ok,
		failed,
	});

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap screw enrichment rerun failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
