import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function buildHexCapCandidateQuery() {
	return {
		$and: [
			{
				$or: [
					{ "fishbowl.partNum": /^MMCS/i },
					{ "fishbowl.partNum": /^(?:SS|HH|SB|AN)?CS\d/i },
					{
						"fishbowl.description":
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\btap bolt\b|\bc\/s\b/i,
					},
					{ sku: /^MMCS/i },
					{ sku: /^(?:SS|HH|SB|AN)?CS\d/i },
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
						"fishbowl.description":
							/socket head cap screw|soc\.?hd\.?c\/s/i,
					},
					{ "fishbowl.description": /spacer assortment/i },
					{ "fishbowl.description": /auveco/i },
					{ sku: /auveco/i },
					{ "fishbowl.partNum": /auveco/i },
					{ "fishbowl.description": /specialty hardware/i },
				],
			},
		],
	};
}

function inferImperialThreadSeries(diameter = "", threadPitch = "") {
	const dia = clean(diameter);
	const pitch = clean(threadPitch);

	if (!dia || !pitch) return "";

	const coarseMap = {
		"#10": "24",
		"1/4": "20",
		"5/16": "18",
		"3/8": "16",
		"7/16": "14",
		"1/2": "13",
		"9/16": "12",
		"5/8": "11",
		"3/4": "10",
		"7/8": "9",
		"1": "8",
	};

	const fineMap = {
		"#10": "32",
		"1/4": "28",
		"5/16": "24",
		"3/8": "24",
		"7/16": "20",
		"1/2": "20",
		"9/16": "18",
		"5/8": "18",
		"3/4": "16",
		"7/8": "14",
		"1": "12",
	};

	if (coarseMap[dia] === pitch) return "coarse";
	if (fineMap[dia] === pitch) return "fine";

	return "";
}

function inferMaterialFromText(text = "") {
	const raw = String(text || "");

	if (/\bs\/s\b/i.test(raw)) return "stainless steel";
	if (/\bstainless\b/i.test(raw)) return "stainless steel";
	if (/[\s/(-]ss[\s/)-]?/i.test(` ${raw} `)) return "stainless steel";
	if (/\bnylon\b/i.test(raw)) return "nylon";
	if (/\balu\b/i.test(raw)) return "aluminum";
	if (/\balum\b/i.test(raw)) return "aluminum";
	if (/\baluminum\b/i.test(raw)) return "aluminum";
	if (/\bbrass\b/i.test(raw)) return "brass";
	if (/\bsilicon bronze\b/i.test(raw)) return "silicon bronze";
	if (
		/\bsteel\b/i.test(raw) ||
		/\buss\b/i.test(raw) ||
		/\bsae\b/i.test(raw) ||
		/\bhex bolt\b/i.test(raw) ||
		/\bhex head bolt\b/i.test(raw) ||
		/\bc\/s\b/i.test(raw)
	) {
		return "steel";
	}

	return "";
}

function inferFinishFromText(text = "", material = "") {
	const raw = String(text || "");
	const mat = normalize(material);

	if (
		["stainless steel", "aluminum", "brass", "nylon", "silicon bronze"].includes(
			mat,
		)
	) {
		return "";
	}

	if (/\bplain\b/i.test(raw)) return "plain";
	if (/\bhot dip galvanized\b/i.test(raw)) return "hot dip galvanized";
	if (/\bhdg\b/i.test(raw)) return "hot dip galvanized";
	if (/\bgalvanized\b/i.test(raw)) return "galvanized";
	if (/\bgalv\b/i.test(raw)) return "galvanized";
	if (/\bchrome\b/i.test(raw)) return "chrome";
	if (/\bcad(?:mium)?(?:-|\s)?plated\b/i.test(raw)) return "cad plated";
	if (/\bzinc\b/i.test(raw)) return "zinc";
	if (/\bzp\b/i.test(raw)) return "zinc";

	if (mat === "steel") return "zinc";

	return "";
}

function buildMaterialFinish(material = "", finish = "") {
	const mat = clean(material);
	const fin = clean(finish);

	if (!mat && !fin) return "";
	if (!fin) return mat;
	if (!mat) return fin;
	return `${mat} / ${fin}`;
}

function shouldProcessEnrichment(enrichment = {}) {
	const category = normalize(enrichment?.category || "");
	const subcategory = normalize(enrichment?.subcategory || "");
	const familyType = normalize(
		enrichment?.attributes?.familyType ||
			enrichment?.attributes?.fastenerTypeCanonical ||
			enrichment?.attributes?.fastenerType ||
			"",
	);

	return (
		category === "bolts" &&
		subcategory === "hex cap screws" &&
		familyType === "hex cap screw"
	);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const products = await Product.find(buildHexCapCandidateQuery(), {
		_id: 1,
		sku: 1,
		internalPartNumber: 1,
		"fishbowl.partNum": 1,
		"fishbowl.description": 1,
	}).lean();

	const productIds = products.map((p) => p._id);
	const productMap = new Map(products.map((p) => [String(p._id), p]));

	const enrichments = await ProductEnrichment.find({
		productId: { $in: productIds },
	}).lean();

	const summary = {
		totalCandidates: enrichments.length,
		processed: 0,
		skipped: 0,
		updated: 0,
		threadSeriesFilled: 0,
		materialFilled: 0,
		finishFilled: 0,
		materialFinishFilled: 0,
		threadCoverageFilled: 0,
	};

	for (const enrichment of enrichments) {
		if (!shouldProcessEnrichment(enrichment)) {
			summary.skipped += 1;
			continue;
		}

		const product = productMap.get(String(enrichment.productId));
		const attrs = { ...(enrichment.attributes || {}) };

		const sourceText = [
			product?.fishbowl?.description || "",
			product?.fishbowl?.partNum || "",
			product?.sku || "",
			attrs.fishbowlDescription || "",
			attrs.fishbowlPartNum || "",
			enrichment.title || "",
			enrichment.description || "",
		]
			.filter(Boolean)
			.join(" ");

		let changed = false;

		const measurementSystem = clean(attrs.measurementSystem || "");
		const diameter = clean(attrs.diameter || "");
		const threadPitch = clean(attrs.threadPitch || "");
		const material = clean(attrs.material || "");
		const finish = clean(attrs.finish || "");
		const materialFinish = clean(attrs.materialFinish || "");
		const threadSeries = clean(attrs.threadSeries || attrs.thread_series || "");
		const threadCoverage = clean(
			attrs.threadCoverage || attrs.thread_coverage || "",
		);

		if (
			normalize(measurementSystem) === "imperial" &&
			diameter &&
			threadPitch &&
			!threadSeries
		) {
			const inferredSeries = inferImperialThreadSeries(diameter, threadPitch);
			if (inferredSeries) {
				attrs.threadSeries = inferredSeries;
				attrs.thread_series = inferredSeries;
				summary.threadSeriesFilled += 1;
				changed = true;
			}
		}

		if (!material) {
			const inferredMaterial = inferMaterialFromText(sourceText);
			if (inferredMaterial) {
				attrs.material = inferredMaterial;
				attrs.displayMaterial = inferredMaterial;
				summary.materialFilled += 1;
				changed = true;
			}
		}

		const nextMaterial = clean(attrs.material || "");

		if (!finish) {
			const inferredFinish = inferFinishFromText(sourceText, nextMaterial);
			if (inferredFinish || nextMaterial) {
				attrs.finish = inferredFinish;
				attrs.displayFinish = inferredFinish || nextMaterial;
				if (inferredFinish) summary.finishFilled += 1;
				changed = true;
			}
		}

		const nextFinish = clean(attrs.finish || "");

		if (!materialFinish) {
			const rebuilt = buildMaterialFinish(nextMaterial, nextFinish);
			if (rebuilt) {
				attrs.materialFinish = rebuilt;
				summary.materialFinishFilled += 1;
				changed = true;
			}
		}

		if (!threadCoverage) {
			if (/tap bolt/i.test(sourceText) || /(?:T|TAP)$/i.test(attrs.fishbowlPartNum || "")) {
				attrs.threadCoverage = "full";
				attrs.thread_coverage = "full";
				summary.threadCoverageFilled += 1;
				changed = true;
			} else if (diameter && (threadPitch || attrs.size)) {
				attrs.threadCoverage = "partial";
				attrs.thread_coverage = "partial";
				summary.threadCoverageFilled += 1;
				changed = true;
			}
		}

		summary.processed += 1;

		if (changed) {
			await ProductEnrichment.updateOne(
				{ _id: enrichment._id },
				{
					$set: {
						attributes: attrs,
						updatedAt: new Date(),
					},
				},
			);
			summary.updated += 1;
		}
	}

	console.log("===== HEX CAP SCREW DERIVED FIELD BACKFILL =====");
	console.log(summary);

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});