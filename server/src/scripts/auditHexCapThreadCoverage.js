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

function increment(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function toCountArray(map) {
	return Array.from(map.entries())
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function isHexCapEnrichment(enrichment = {}) {
	const category = normalize(enrichment.category || "");
	const subcategory = normalize(enrichment.subcategory || "");
	const familyType = normalize(
		enrichment?.attributes?.familyType ||
			enrichment?.attributes?.fastenerTypeCanonical ||
			enrichment?.attributes?.fastenerType ||
			"",
	);

	return (
		category === "bolts" &&
		subcategory === "hex cap screws" &&
		[
			"hex cap screw",
			"heavy hex bolt",
			"structural bolt",
		].includes(familyType)
	);
}

function isTapBoltByPartNumberToken(token = "") {
	const raw = clean(token).toUpperCase().replace(/\s+/g, "");
	return (
		/^(?:SS|HH|SB|AN|AL|BR)?CS[A-Z0-9]+(?:T|TAP)$/i.test(raw) ||
		/^CSA[A-Z0-9]+(?:T|TAP)$/i.test(raw)
	);
}

function isTapBoltByText(text = "") {
	return (
		/\btap\s*bolt\b/i.test(text) ||
		/\bfull(?:y)?\s*thread(?:ed)?\b/i.test(text) ||
		/\bfull\s*thread\b/i.test(text)
	);
}

function expectedCoverage(product = {}, enrichment = {}) {
	const attrs = enrichment?.attributes || {};
	const tokens = [
		attrs.fishbowlPartNum,
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
	]
		.map(clean)
		.filter(Boolean);

	const text = [
		...tokens,
		product?.fishbowl?.description || "",
		attrs.fishbowlDescription || "",
		enrichment.title || "",
		enrichment.description || "",
	]
		.filter(Boolean)
		.join(" ");

	return tokens.some(isTapBoltByPartNumberToken) || isTapBoltByText(text)
		? "full"
		: "partial";
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const enrichments = await ProductEnrichment.find({
		category: /^bolts$/i,
		subcategory: /^hex cap screws$/i,
	}).lean();

	const productIds = enrichments.map((item) => item.productId).filter(Boolean);
	const products = await Product.find(
		{ _id: { $in: productIds } },
		{
			_id: 1,
			sku: 1,
			internalPartNumber: 1,
			"fishbowl.partNum": 1,
			"fishbowl.description": 1,
		},
	).lean();

	const productMap = new Map(products.map((item) => [String(item._id), item]));
	const candidates = enrichments.filter(isHexCapEnrichment);

	const counts = new Map();
	const summary = {
		hexCapCandidates: candidates.length,
		missingThreadCoverage: 0,
		wrongThreadCoverage: 0,
		fullExpected: 0,
		partialExpected: 0,
	};
	const samples = [];

	for (const enrichment of candidates) {
		const product = productMap.get(String(enrichment.productId));
		if (!product) continue;

		const attrs = enrichment.attributes || {};
		const actual = clean(attrs.threadCoverage || attrs.thread_coverage || "").toLowerCase();
		const expected = expectedCoverage(product, enrichment);
		increment(counts, actual || "(blank)");

		if (expected === "full") summary.fullExpected += 1;
		if (expected === "partial") summary.partialExpected += 1;

		if (!actual) summary.missingThreadCoverage += 1;
		if (actual && actual !== expected) summary.wrongThreadCoverage += 1;

		if ((!actual || actual !== expected) && samples.length < 50) {
			samples.push({
				productId: String(product._id),
				partNumber: product?.fishbowl?.partNum || product?.sku || "",
				description: product?.fishbowl?.description || "",
				actual: actual || "(blank)",
				expected,
			});
		}
	}

	console.log("===== HEX CAP THREAD COVERAGE AUDIT =====");
	console.log(JSON.stringify({
		summary,
		counts: toCountArray(counts),
		samples,
	}, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap thread coverage audit failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
