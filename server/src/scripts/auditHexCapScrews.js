import "../config/env.js";
import mongoose from "mongoose";

import fs from "fs";
import path from "path";

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
							/\bhex cap screw\b|\bhex head bolt\b|\bhex bolt\b|\bheavy hex bolt\b|\bstructural bolt\b|\ba307\b|\ba325\b|\btap bolt\b|\bc\/s\b/i,
					},
					{ sku: /^MMCS/i },
					{
						sku: /^(?:SS|HH|SB|AN|AL|BR)?CS\d[CF]\d{2,3}\d{4}(?:P|T|TAP)?$/i,
					},
				],
			},
			{
				$nor: [
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

					{ "fishbowl.description": /countersink|combo drill/i },
					{ sku: /^CS\d+\s*T/i },
					{ "fishbowl.partNum": /^CS\d+\s*T/i },
				],
			},
		],
	};
}

function pushSample(map, key, sample, max = 15) {
	if (!map.has(key)) map.set(key, []);
	const arr = map.get(key);
	if (arr.length < max) arr.push(sample);
}

function increment(map, key, amount = 1) {
	map.set(key, (map.get(key) || 0) + amount);
}

function toSortedCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort(
			(a, b) =>
				b.count - a.count || String(a.value).localeCompare(String(b.value)),
		);
}

function isAllowedFamily(familyType = "") {
	const value = normalize(familyType);
	return (
		value === "hex cap screw" ||
		value === "heavy hex bolt" ||
		value === "structural bolt"
	);
}

function isAllowedSubcategory(subcategory = "") {
	return normalize(subcategory) === "hex cap screws";
}

function isAllowedCategory(category = "") {
	return normalize(category) === "bolts";
}

function shouldRequireGrade(sample = {}) {
	const familyType = normalize(sample.familyType || "");
	const material = normalize(sample.material || "");

	if (!isAllowedFamily(familyType)) return false;

	if (
		material === "stainless steel" ||
		material === "aluminum" ||
		material === "brass" ||
		material === "nylon" ||
		material === "silicon bronze"
	) {
		return false;
	}

	return true;
}

function shouldRequireFinish(sample = {}) {
	const familyType = normalize(sample.familyType || "");
	const material = normalize(sample.material || "");

	if (!isAllowedFamily(familyType)) return false;

	if (
		material === "stainless steel" ||
		material === "aluminum" ||
		material === "brass" ||
		material === "nylon" ||
		material === "silicon bronze"
	) {
		return false;
	}

	return true;
}

function shouldRequireDriveType(sample = {}) {
	return isAllowedFamily(sample.familyType || "");
}

function shouldRequireThreadSeries(sample = {}) {
	if (!isAllowedFamily(sample.familyType || "")) return false;
	return normalize(sample.measurementSystem || "") === "imperial";
}

function looksRawFishbowlTitle(sample = {}) {
	const title = String(sample.title || "");
	const description = String(sample.description || "");
	const familyType = normalize(sample.familyType || "");

	if (!title) return false;
	if (!isAllowedFamily(familyType)) return false;

	return (
		/^c\/s\b/i.test(title) ||
		/^tap bolt\b/i.test(title) ||
		(/^hex cap screw\b/i.test(title) === false &&
			/^heavy hex bolt\b/i.test(title) === false &&
			/^structural bolt\b/i.test(title) === false &&
			/\bgr\d\b/i.test(title))
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
		"review.status": 1,
		"review.publishReady": 1,
		"review.renderable": 1,
		"review.qualityScore": 1,
		isPublished: 1,
		catalogStatus: 1,
	}).lean();

	const productIds = products.map((p) => p._id);

	const enrichments = await ProductEnrichment.find(
		{ productId: { $in: productIds } },
		{
			productId: 1,
			title: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
			quality: 1,
		},
	).lean();

	const enrichmentMap = new Map(
		enrichments.map((item) => [String(item.productId), item]),
	);

	const totals = {
		candidateProducts: products.length,
		withEnrichment: 0,
		missingEnrichment: 0,
		publishReady: 0,
		needsReview: 0,
		approved: 0,
		published: 0,
		wrongFamily: 0,
		wrongCategory: 0,
		wrongSubcategory: 0,
		rawFishbowlTitleLikely: 0,
		tapBoltCount: 0,
		missingDiameter: 0,
		missingLength: 0,
		missingThreadPitch: 0,
		missingThreadSeries: 0,
		missingGrade: 0,
		missingMaterial: 0,
		missingFinish: 0,
		missingMaterialFinish: 0,
		missingDriveType: 0,
	};

	const counts = {
		reviewStatus: new Map(),
		category: new Map(),
		subcategory: new Map(),
		familyType: new Map(),
		grade: new Map(),
		material: new Map(),
		finish: new Map(),
		materialFinish: new Map(),
		measurementSystem: new Map(),
		threadSeries: new Map(),
		threadPitch: new Map(),
		driveType: new Map(),
		threadCoverage: new Map(),
	};

	const samples = {
		missingEnrichment: new Map(),
		wrongFamily: new Map(),
		wrongCategory: new Map(),
		wrongSubcategory: new Map(),
		missingThreadPitch: new Map(),
		missingThreadSeries: new Map(),
		missingGrade: new Map(),
		missingMaterial: new Map(),
		missingFinish: new Map(),
		missingLength: new Map(),
		rawFishbowlTitleLikely: new Map(),
		tapBolts: new Map(),
	};

	for (const product of products) {
		const enrichment = enrichmentMap.get(String(product._id));
		const partNumber =
			product?.fishbowl?.partNum ||
			product?.sku ||
			product?.internalPartNumber ||
			"";
		const description = product?.fishbowl?.description || "";

		const sample = {
			id: String(product._id),
			partNumber,
			sku: product?.sku || "",
			description,
			title: enrichment?.title || "",
			category: enrichment?.category || "",
			subcategory: enrichment?.subcategory || "",
			familyType: enrichment?.attributes?.familyType || "",
			diameter: enrichment?.attributes?.diameter || "",
			threadPitch: enrichment?.attributes?.threadPitch || "",
			threadSeries:
				enrichment?.attributes?.threadSeries ||
				enrichment?.attributes?.thread_series ||
				"",
			length: enrichment?.attributes?.length || "",
			grade: enrichment?.attributes?.grade || "",
			material: enrichment?.attributes?.material || "",
			finish: enrichment?.attributes?.finish || "",
			materialFinish: enrichment?.attributes?.materialFinish || "",
			measurementSystem: enrichment?.attributes?.measurementSystem || "",
			driveType:
				enrichment?.attributes?.driveType ||
				enrichment?.attributes?.drive_type ||
				"",
			threadCoverage:
				enrichment?.attributes?.threadCoverage ||
				enrichment?.attributes?.thread_coverage ||
				"",
			reviewStatus: product?.review?.status || "needs-review",
			qualityScore: Number(product?.review?.qualityScore || 0),
			publishReady: !!product?.review?.publishReady,
		};

		const reviewStatus = sample.reviewStatus;
		increment(counts.reviewStatus, reviewStatus);

		if (reviewStatus === "needs-review") totals.needsReview += 1;
		if (reviewStatus === "approved") totals.approved += 1;
		if (reviewStatus === "published" || product?.isPublished) {
			totals.published += 1;
		}
		if (product?.review?.publishReady) totals.publishReady += 1;

		if (!enrichment) {
			totals.missingEnrichment += 1;
			pushSample(samples.missingEnrichment, "missingEnrichment", sample);
			continue;
		}

		totals.withEnrichment += 1;

		const category = clean(sample.category);
		const subcategory = clean(sample.subcategory);
		const familyType = clean(sample.familyType);
		const grade = clean(sample.grade);
		const material = clean(sample.material);
		const finish = clean(sample.finish);
		const materialFinish = clean(sample.materialFinish);
		const measurementSystem = clean(sample.measurementSystem);
		const threadSeries = clean(sample.threadSeries);
		const threadPitch = clean(sample.threadPitch);
		const driveType = clean(sample.driveType);
		const threadCoverage = clean(sample.threadCoverage);
		const diameter = clean(sample.diameter);
		const length = clean(sample.length);

		increment(counts.category, category || "(blank)");
		increment(counts.subcategory, subcategory || "(blank)");
		increment(counts.familyType, familyType || "(blank)");
		increment(counts.grade, grade || "(blank)");
		increment(counts.material, material || "(blank)");
		increment(counts.finish, finish || "(blank)");
		increment(counts.materialFinish, materialFinish || "(blank)");
		increment(
			counts.measurementSystem,
			measurementSystem || "(blank)",
		);
		increment(counts.threadSeries, threadSeries || "(blank)");
		increment(counts.threadPitch, threadPitch || "(blank)");
		increment(counts.driveType, driveType || "(blank)");
		increment(counts.threadCoverage, threadCoverage || "(blank)");

		if (!isAllowedCategory(category)) {
			totals.wrongCategory += 1;
			pushSample(samples.wrongCategory, "wrongCategory", sample);
		}

		if (!isAllowedSubcategory(subcategory)) {
			totals.wrongSubcategory += 1;
			pushSample(samples.wrongSubcategory, "wrongSubcategory", sample);
		}

		if (!isAllowedFamily(familyType)) {
			totals.wrongFamily += 1;
			pushSample(samples.wrongFamily, "wrongFamily", sample);
		}

		if (!diameter) {
			totals.missingDiameter += 1;
		}

		if (!length) {
			totals.missingLength += 1;
			pushSample(samples.missingLength, "missingLength", sample);
		}

		if (!threadPitch) {
			totals.missingThreadPitch += 1;
			pushSample(samples.missingThreadPitch, "missingThreadPitch", sample);
		}

		if (shouldRequireThreadSeries(sample) && !threadSeries) {
			totals.missingThreadSeries += 1;
			pushSample(samples.missingThreadSeries, "missingThreadSeries", sample);
		}

		if (shouldRequireGrade(sample) && !grade) {
			totals.missingGrade += 1;
			pushSample(samples.missingGrade, "missingGrade", sample);
		}

		if (!material) {
			totals.missingMaterial += 1;
			pushSample(samples.missingMaterial, "missingMaterial", sample);
		}

		if (shouldRequireFinish(sample) && !finish) {
			totals.missingFinish += 1;
			pushSample(samples.missingFinish, "missingFinish", sample);
		}

		if (!materialFinish) {
			totals.missingMaterialFinish += 1;
		}

		if (shouldRequireDriveType(sample) && !driveType) {
			totals.missingDriveType += 1;
		}

		if (looksRawFishbowlTitle(sample)) {
			totals.rawFishbowlTitleLikely += 1;
			pushSample(
				samples.rawFishbowlTitleLikely,
				"rawFishbowlTitleLikely",
				sample,
			);
		}

		if (normalize(threadCoverage) === "full" || /tap bolt/i.test(description)) {
			totals.tapBoltCount += 1;
			pushSample(samples.tapBolts, "tapBolts", sample);
		}
	}

	const report = {
		totals,
		topCounts: {
			reviewStatus: toSortedCountArray(counts.reviewStatus),
			category: toSortedCountArray(counts.category).slice(0, 15),
			subcategory: toSortedCountArray(counts.subcategory).slice(0, 15),
			familyType: toSortedCountArray(counts.familyType).slice(0, 15),
			grade: toSortedCountArray(counts.grade).slice(0, 20),
			material: toSortedCountArray(counts.material).slice(0, 20),
			finish: toSortedCountArray(counts.finish).slice(0, 20),
			materialFinish: toSortedCountArray(counts.materialFinish).slice(0, 20),
			measurementSystem: toSortedCountArray(counts.measurementSystem),
			threadSeries: toSortedCountArray(counts.threadSeries),
			threadPitch: toSortedCountArray(counts.threadPitch).slice(0, 30),
			driveType: toSortedCountArray(counts.driveType).slice(0, 10),
			threadCoverage: toSortedCountArray(counts.threadCoverage).slice(0, 10),
		},
		sampleBuckets: {
			missingEnrichment:
				samples.missingEnrichment.get("missingEnrichment") || [],
			wrongCategory: samples.wrongCategory.get("wrongCategory") || [],
			wrongSubcategory: samples.wrongSubcategory.get("wrongSubcategory") || [],
			wrongFamily: samples.wrongFamily.get("wrongFamily") || [],
			missingLength: samples.missingLength.get("missingLength") || [],
			missingThreadPitch:
				samples.missingThreadPitch.get("missingThreadPitch") || [],
			missingThreadSeries:
				samples.missingThreadSeries.get("missingThreadSeries") || [],
			missingGrade: samples.missingGrade.get("missingGrade") || [],
			missingMaterial: samples.missingMaterial.get("missingMaterial") || [],
			missingFinish: samples.missingFinish.get("missingFinish") || [],
			rawFishbowlTitleLikely:
				samples.rawFishbowlTitleLikely.get("rawFishbowlTitleLikely") || [],
			tapBolts: samples.tapBolts.get("tapBolts") || [],
		},
	};

	const outputPath = path.resolve(
		process.cwd(),
		"tmp",
		"hex-cap-screw-audit.json",
	);

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

	console.log("===== HEX CAP SCREW AUDIT SUMMARY =====");
	console.log(`Full report written to: ${outputPath}`);

	console.log("\nTOTALS");
	console.table(report.totals);

	console.log("\nTOP COUNTS");
	console.log("\nREVIEWSTATUS");
	console.table(report.topCounts.reviewStatus);

	console.log("\nCATEGORY");
	console.table(report.topCounts.category);

	console.log("\nSUBCATEGORY");
	console.table(report.topCounts.subcategory);

	console.log("\nFAMILYTYPE");
	console.table(report.topCounts.familyType);

	console.log("\nGRADE");
	console.table(report.topCounts.grade);

	console.log("\nMATERIAL");
	console.table(report.topCounts.material);

	console.log("\nFINISH");
	console.table(report.topCounts.finish);

	console.log("\nMATERIALFINISH");
	console.table(report.topCounts.materialFinish);

	console.log("\nMEASUREMENTSYSTEM");
	console.table(report.topCounts.measurementSystem);

	console.log("\nTHREADSERIES");
	console.table(report.topCounts.threadSeries);

	console.log("\nTHREADPITCH");
	console.table(report.topCounts.threadPitch);

	console.log("\nDRIVETYPE");
	console.table(report.topCounts.driveType);

	console.log("\nTHREADCOVERAGE");
	console.table(report.topCounts.threadCoverage);

	console.log("\nSAMPLE BUCKET COUNTS");
	console.table(
		Object.fromEntries(
			Object.entries(report.sampleBuckets).map(([key, rows]) => [key, rows.length]),
		),
	);

	console.log("\nKEY SAMPLE ROWS");
	for (const [bucket, rows] of Object.entries(report.sampleBuckets)) {
		if (!rows.length) continue;
		console.log(`\n--- ${bucket} (showing up to 5) ---`);
		console.table(rows.slice(0, 5));
	}

	console.log("\nFOCUSED SAMPLE ROWS");

	const focusedBuckets = [
		"missingThreadSeries",
		"missingThreadPitch",
		"missingMaterial",
	];

	for (const bucket of focusedBuckets) {
		const rows = report.sampleBuckets[bucket] || [];
		if (!rows.length) continue;

		console.log(`\n--- ${bucket} (showing up to 15) ---`);
		console.table(
			rows.map((row) => ({
				partNumber: row.partNumber,
				description: row.description,
				title: row.title,
				diameter: row.diameter,
				threadPitch: row.threadPitch,
				threadSeries: row.threadSeries,
				length: row.length,
				grade: row.grade,
				material: row.material,
				finish: row.finish,
				measurementSystem: row.measurementSystem || "",
				threadCoverage: row.threadCoverage,
			})),
		);
	}

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap screw audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});