import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const VALID_IMAGE_STATUS = new Set([
	"none",
	"matched",
	"partial",
	"needs-cleanup",
	"approved",
]);

const VALID_IMAGE_SOURCE = new Set([
	"vendor",
	"manual",
	"generated",
	"website",
	"unknown",
]);

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function getArgs() {
	const args = new Set(process.argv.slice(2));
	return {
		dryRun: args.has("--dry-run"),
		samples: args.has("--samples"),
	};
}

function sanitizeImageEnums(enrichment) {
	let changed = false;

	if (!VALID_IMAGE_STATUS.has(enrichment.imageStatus || "none")) {
		enrichment.imageStatus = "matched";
		changed = true;
	}

	if (Array.isArray(enrichment.images)) {
		for (const image of enrichment.images) {
			if (!VALID_IMAGE_SOURCE.has(image?.source || "unknown")) {
				image.source = "generated";
				changed = true;
			}
		}
	}

	return changed;
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

function partTokensFor(product = {}, attrs = {}) {
	return [
		attrs.fishbowlPartNum,
		product?.fishbowl?.partNum,
		product?.sku,
		product?.internalPartNumber,
	]
		.map(clean)
		.filter(Boolean);
}

function isTapBoltByPartNumberToken(token = "") {
	const raw = clean(token).toUpperCase().replace(/\s+/g, "");
	if (!raw) return false;

	// Current hex-cap-screw tap-bolt convention, e.g. SSCS120700T or CS5C080200T.
	if (/^(?:SS|HH|SB|AN|AL|BR)?CS[A-Z0-9]+(?:T|TAP)$/i.test(raw)) {
		return true;
	}

	// A307/CSA and similar hex-head conventions sometimes carry a tap suffix too.
	if (/^CSA[A-Z0-9]+(?:T|TAP)$/i.test(raw)) {
		return true;
	}

	return false;
}

function isTapBoltByText(text = "") {
	const value = normalize(text);
	if (!value) return false;

	return (
		/\btap\s*bolt\b/i.test(text) ||
		/\bfull(?:y)?\s*thread(?:ed)?\b/i.test(text) ||
		/\bfull\s*thread\b/i.test(text)
	);
}

function inferThreadCoverage({ product = {}, enrichment = {} } = {}) {
	const attrs = enrichment?.attributes || {};
	const tokens = partTokensFor(product, attrs);
	const text = [
		...tokens,
		product?.fishbowl?.description || "",
		attrs.fishbowlDescription || "",
		enrichment.title || "",
		enrichment.description || "",
	]
		.filter(Boolean)
		.join(" ");

	if (tokens.some(isTapBoltByPartNumberToken) || isTapBoltByText(text)) {
		return "full";
	}

	return "partial";
}

async function main() {
	const { dryRun, samples } = getArgs();

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(
		dryRun
			? "🔎 Dry run: checking hex cap screw thread coverage"
			: "✍️ Applying hex cap screw thread coverage backfill",
	);

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
	const updates = [];
	const summary = {
		hexCapCandidates: candidates.length,
		wouldUpdate: 0,
		updated: 0,
		alreadyCorrect: 0,
		full: 0,
		partial: 0,
		failed: 0,
	};

	for (const enrichment of candidates) {
		const product = productMap.get(String(enrichment.productId));
		if (!product) continue;

		const attrs = enrichment.attributes || {};
		const current = clean(attrs.threadCoverage || attrs.thread_coverage || "").toLowerCase();
		const next = inferThreadCoverage({ product, enrichment });

		if (next === "full") summary.full += 1;
		if (next === "partial") summary.partial += 1;

		if (current === next && attrs.threadCoverage === next && attrs.thread_coverage === next) {
			summary.alreadyCorrect += 1;
			continue;
		}

		const sample = {
			productId: String(product._id),
			partNumber: product?.fishbowl?.partNum || product?.sku || "",
			description: product?.fishbowl?.description || "",
			current: current || "(blank)",
			next,
		};
		updates.push(sample);
		summary.wouldUpdate += 1;

		if (dryRun) continue;

		try {
			const doc = await ProductEnrichment.findById(enrichment._id);
			if (!doc) continue;

			const nextAttrs = {
				...(doc.attributes?.toObject?.() || doc.attributes || {}),
				threadCoverage: next,
				thread_coverage: next,
			};

			doc.attributes = nextAttrs;
			doc.markModified("attributes");
			sanitizeImageEnums(doc);

			await doc.save();
			summary.updated += 1;
		} catch (err) {
			summary.failed += 1;
			console.warn("Failed to update", sample, err.message);
		}
	}

	console.log("===== HEX CAP THREAD COVERAGE SUMMARY =====");
	console.log(JSON.stringify(summary, null, 2));

	if (samples || dryRun) {
		console.log("===== SAMPLE UPDATES =====");
		console.log(JSON.stringify(updates.slice(0, 50), null, 2));
	}

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Hex cap thread coverage backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
