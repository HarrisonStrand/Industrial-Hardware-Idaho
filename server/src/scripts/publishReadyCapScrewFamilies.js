import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function parseArgs(argv = process.argv.slice(2)) {
	const args = new Set(argv);
	const getValue = (name, fallback = "") => {
		const prefix = `${name}=`;
		const found = argv.find((item) => item.startsWith(prefix));
		return found ? found.slice(prefix.length) : fallback;
	};

	return {
		dryRun: args.has("--dry-run") || args.has("--dry"),
		limit: Number(getValue("--limit", "0")) || 0,
		family: normalize(getValue("--family", "all")),
		measurementSystem: normalize(getValue("--system", "all")),
		listSamples: args.has("--list") || args.has("--samples"),
	};
}

const FAMILY_CONFIGS = [
	{
		key: "hex",
		label: "Hex Cap Screws",
		subcategory: "hex cap screws",
		familyTypes: ["hex cap screw", "heavy hex bolt", "structural bolt"],
		measurementSystems: ["imperial", "metric"],
	},
	{
		key: "button",
		label: "Button Head Cap Screws",
		subcategory: "button head cap screws",
		familyTypes: ["button head cap screw"],
		measurementSystems: ["imperial", "metric"],
	},
	{
		key: "socket",
		label: "Socket Head Cap Screws",
		subcategory: "socket head cap screws",
		familyTypes: ["socket head cap screw"],
		measurementSystems: ["imperial", "metric"],
	},
	{
		key: "flat-metric",
		aliases: ["flat", "metric-flat"],
		label: "Metric Flat Head Cap Screws",
		subcategory: "flat head cap screws",
		familyTypes: ["flat head cap screw"],
		measurementSystems: ["metric"],
	},
];

function matchesFamilyConfig(enrichment = {}, config) {
	const attrs = enrichment?.attributes || {};
	const category = normalize(enrichment?.category || attrs.categoryCanonical || "");
	const subcategory = normalize(
		enrichment?.subcategory || attrs.subcategoryCanonical || "",
	);
	const familyType = normalize(
		attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
	);
	const measurementSystem = normalize(attrs.measurementSystem || "");

	if (category !== "bolts") return false;
	if (subcategory !== normalize(config.subcategory)) return false;
	if (!config.familyTypes.map(normalize).includes(familyType)) return false;
	if (!config.measurementSystems.map(normalize).includes(measurementSystem)) {
		return false;
	}

	return true;
}

function getConfigForEnrichment(enrichment = {}, configs = FAMILY_CONFIGS) {
	return configs.find((config) => matchesFamilyConfig(enrichment, config)) || null;
}

function getSelectedConfigs(familyArg = "all") {
	const normalized = normalize(familyArg || "all");
	if (!normalized || normalized === "all") return FAMILY_CONFIGS;

	return FAMILY_CONFIGS.filter((config) => {
		const aliases = [config.key, ...(config.aliases || [])].map(normalize);
		return aliases.includes(normalized);
	});
}

function applyMeasurementSystemFilter(configs = [], systemArg = "all") {
	const system = normalize(systemArg || "all");
	if (!system || system === "all") return configs;

	return configs
		.map((config) => ({
			...config,
			measurementSystems: config.measurementSystems.filter(
				(value) => normalize(value) === system,
			),
		}))
		.filter((config) => config.measurementSystems.length > 0);
}

function summarizeByFamily(rows = []) {
	const summary = new Map();

	for (const row of rows) {
		const key = `${row.familyKey}|${row.measurementSystem}`;
		if (!summary.has(key)) {
			summary.set(key, {
				family: row.familyLabel,
				measurementSystem: row.measurementSystem,
				count: 0,
			});
		}
		summary.get(key).count += 1;
	}

	return Array.from(summary.values()).sort(
		(a, b) =>
			a.family.localeCompare(b.family) ||
			a.measurementSystem.localeCompare(b.measurementSystem),
	);
}

async function findReadyCandidates(configs = []) {
	const products = await Product.find({
		isActive: true,
		isPublished: { $ne: true },
		"review.status": "ready",
		"review.publishReady": true,
	})
		.select({
			_id: 1,
			sku: 1,
			internalPartNumber: 1,
			"fishbowl.partNum": 1,
			"fishbowl.description": 1,
			"review.status": 1,
			"review.publishReady": 1,
			"review.renderable": 1,
			"review.qualityScore": 1,
			isPublished: 1,
			isActive: 1,
		})
		.lean();

	if (!products.length) return [];

	const productMap = new Map(products.map((product) => [String(product._id), product]));
	const enrichments = await ProductEnrichment.find({
		productId: { $in: products.map((product) => product._id) },
	})
		.select({
			productId: 1,
			title: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
			"seo.slug": 1,
			quality: 1,
		})
		.lean();

	const rows = [];

	for (const enrichment of enrichments) {
		const config = getConfigForEnrichment(enrichment, configs);
		if (!config) continue;

		const product = productMap.get(String(enrichment.productId));
		if (!product) continue;

		const attrs = enrichment.attributes || {};

		rows.push({
			productId: product._id,
			enrichmentId: enrichment._id,
			partNumber:
				attrs.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || "",
			sku: product?.sku || "",
			title: enrichment?.title || product?.fishbowl?.description || "",
			familyKey: config.key,
			familyLabel: config.label,
			measurementSystem: normalize(attrs.measurementSystem || ""),
			subcategory: enrichment?.subcategory || "",
			familyType:
				attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "",
			qualityScore: Number(product?.review?.qualityScore || 0),
			slug: enrichment?.seo?.slug || "",
		});
	}

	return rows;
}

async function publishRows(rows = [], { dryRun = true, limit = 0 } = {}) {
	const targetRows = limit > 0 ? rows.slice(0, limit) : rows;
	const now = new Date();
	const summary = {
		matched: rows.length,
		limitedTo: targetRows.length,
		published: 0,
		failed: 0,
		failures: [],
	};

	if (dryRun) return summary;

	for (const row of targetRows) {
		try {
			const productResult = await Product.updateOne(
				{
					_id: row.productId,
					isActive: true,
					isPublished: { $ne: true },
					"review.status": "ready",
					"review.publishReady": true,
				},
				{
					$set: {
						isPublished: true,
						needsReview: false,
						catalogStatus: "published",
						"review.status": "published",
						"review.publishedAt": now,
						"review.publishedBy": {
							source: "script",
							script: "publishReadyCapScrewFamilies.js",
							family: row.familyKey,
							measurementSystem: row.measurementSystem,
						},
					},
					$setOnInsert: {},
				},
			);

			if (productResult.modifiedCount !== 1) {
				summary.failed += 1;
				summary.failures.push({
					partNumber: row.partNumber,
					reason: "Product was not modified. It may no longer be ready or may already be published.",
				});
				continue;
			}

			await ProductEnrichment.updateOne(
				{ _id: row.enrichmentId },
				{
					$set: {
						"quality.publishReady": true,
						"quality.renderable": true,
						"quality.builderReady": true,
						"quality.lastEvaluatedAt": now,
					},
				},
			);

			summary.published += 1;
		} catch (err) {
			summary.failed += 1;
			summary.failures.push({
				partNumber: row.partNumber,
				error: err.message,
			});
		}
	}

	return summary;
}

async function main() {
	const options = parseArgs();
	let configs = getSelectedConfigs(options.family);
	configs = applyMeasurementSystemFilter(configs, options.measurementSystem);

	if (!configs.length) {
		console.error("❌ No matching family/system config found.");
		console.error("Use --family=all|hex|button|socket|flat-metric and --system=all|imperial|metric");
		process.exit(1);
	}

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(options.dryRun ? "🔎 Dry run: no products will be published" : "✍️ Publishing ready cap screw families");

	console.log(
		"Target configs:",
		configs.map((config) => ({
			family: config.key,
			subcategory: config.subcategory,
			measurementSystems: config.measurementSystems,
		})),
	);

	const rows = await findReadyCandidates(configs);
	const limitedRows = options.limit > 0 ? rows.slice(0, options.limit) : rows;

	console.log("===== READY PUBLISH CANDIDATE SUMMARY =====");
	console.log(JSON.stringify(summarizeByFamily(rows), null, 2));
	console.log(`Total ready candidates: ${rows.length}`);

	if (options.listSamples) {
		console.log("===== SAMPLE CANDIDATES =====");
		console.log(
			JSON.stringify(
				limitedRows.slice(0, 100).map((row) => ({
					partNumber: row.partNumber,
					family: row.familyLabel,
					measurementSystem: row.measurementSystem,
					subcategory: row.subcategory,
					familyType: row.familyType,
					title: row.title,
					qualityScore: row.qualityScore,
					slug: row.slug,
				})),
				null,
				2,
			),
		);
	}

	const result = await publishRows(rows, options);

	console.log("===== PUBLISH SUMMARY =====");
	console.log(JSON.stringify(result, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Ready cap screw publish failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
