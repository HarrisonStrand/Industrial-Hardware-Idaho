import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";
import {
	attributesFromDecoded,
	buildTitle,
	clean,
	decodeCapScrewHeadFamilyFromProduct,
	slugify,
} from "./capScrewHeadFamilyUtils.js";

const dryRun = process.argv.includes("--dry-run");
const showSamples = process.argv.includes("--samples");

const buttonHeadPattern = /\b(?:BHCS|SSSB|MMSB)\d{5,8}(?:FLH|F|LH|Z|SS)?\b|button\s*head\s*(?:cap\s*)?screw|buttonhead\s*(?:cap\s*)?screw|btn\.?\s*hd\.?/i;

function getArgValue(name, fallback = "") {
	const prefix = `--${name}=`;
	const found = process.argv.find((arg) => arg.startsWith(prefix));
	return found ? found.slice(prefix.length) : fallback;
}

const limit = Math.max(0, Number(getArgValue("limit", "0")) || 0);

function uniqueStrings(values = []) {
	return [...new Set(values.filter(Boolean).map((value) => clean(value)))];
}

async function buildUniqueSlug({ title = "", product = null, existingEnrichmentId = null }) {
	const baseFromTitle = slugify(title);
	const baseFromPart = slugify(product?.fishbowl?.partNum || "") || slugify(product?.sku || "");
	const fallbackBase = baseFromTitle || baseFromPart || "product";

	const candidates = uniqueStrings([
		fallbackBase,
		`${fallbackBase}-${slugify(product?.fishbowl?.partNum || "")}`,
		`${fallbackBase}-${slugify(product?.sku || "")}`,
		slugify(product?.fishbowl?.partNum || ""),
		slugify(product?.sku || ""),
	]);

	for (const candidate of candidates) {
		if (!candidate) continue;
		const existing = await ProductEnrichment.findOne({ "seo.slug": candidate })
			.select({ _id: 1, productId: 1 })
			.lean();

		if (!existing) return candidate;
		if (existingEnrichmentId && String(existing._id) === String(existingEnrichmentId)) {
			return candidate;
		}
	}

	return `${fallbackBase}-${String(product?._id || "").slice(-6)}`;
}

function recomputeStatusFromReadiness(readiness = {}, product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	if (readiness?.publishReady) return "ready";
	return "needs-review";
}

async function recomputeAndPersistReview(product) {
	const readiness = await evaluateProductPublishReadiness(product._id, {
		includeSimilarFamilies: false,
	});
	const nextStatus = recomputeStatusFromReadiness(readiness, product);

	product.review = {
		...(product.review?.toObject?.() || product.review || {}),
		status: nextStatus,
		issues: readiness.issues || [],
		missingRequiredAttributes: readiness.missingRequiredAttributes || [],
		missingRecommendedAttributes: readiness.missingRecommendedAttributes || [],
		renderable: !!readiness.renderable,
		publishReady: !!readiness.publishReady,
		qualityScore: Number(readiness.qualityScore || 0),
		suggestedFamilyKey: readiness.suggestedFamilyKey || "",
		reviewedAt: new Date(),
	};

	product.needsReview = nextStatus === "needs-review";
	product.catalogStatus = product.isPublished
		? "published"
		: readiness.publishReady
			? "ready"
			: "enriched";
}

function buildDescription(title = "", decoded = {}, product = {}) {
	const partNumber = product?.fishbowl?.partNum || product?.sku || "";
	const details = [
		decoded.measurementSystem ? `Measurement System: ${decoded.measurementSystem}` : "",
		decoded.diameter ? `Diameter: ${decoded.diameter}` : "",
		decoded.threadPitch ? `Thread Pitch: ${decoded.threadPitch}` : "",
		decoded.threadSeries ? `Thread Series: ${decoded.threadSeries}` : "",
		decoded.length ? `Length: ${decoded.length}` : "",
		decoded.headProfile ? `Head Profile: ${decoded.headProfile}` : "",
		decoded.materialFinish ? `Material / Finish: ${decoded.materialFinish}` : "",
		decoded.grade ? `Grade: ${decoded.grade}` : "",
	].filter(Boolean);

	return clean([
		title,
		details.length ? `Detected specs include ${details.join(", ")}.` : "",
		partNumber ? `Fishbowl part number: ${partNumber}.` : "",
	].filter(Boolean).join(" "));
}

function buildBullets(decoded = {}) {
	return [
		decoded.measurementSystem ? `Measurement System: ${decoded.measurementSystem}` : "",
		decoded.diameter ? `Diameter: ${decoded.diameter}` : "",
		decoded.threadPitch ? `Thread Pitch: ${decoded.threadPitch}` : "",
		decoded.threadSeries ? `Thread Series: ${decoded.threadSeries}` : "",
		decoded.length ? `Length: ${decoded.length}` : "",
		decoded.headProfile ? `Head Profile: ${decoded.headProfile}` : "",
		decoded.materialFinish ? `Material / Finish: ${decoded.materialFinish}` : "",
		decoded.grade ? `Grade: ${decoded.grade}` : "",
	].filter(Boolean);
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(`${dryRun ? "🧪 Dry run" : "✍️ Applying"} misfiled button head cap screw cleanup`);

	const hexCapEnrichments = await ProductEnrichment.find({
		category: /^bolts$/i,
		subcategory: /^hex cap screws$/i,
	})
		.select({ _id: 1, productId: 1, title: 1, description: 1, attributes: 1, seo: 1 })
		.lean();

	const productIds = hexCapEnrichments.map((item) => item.productId).filter(Boolean);
	const productQuery = {
		_id: { $in: productIds },
		$or: [
			{ "fishbowl.partNum": buttonHeadPattern },
			{ sku: buttonHeadPattern },
			{ internalPartNumber: buttonHeadPattern },
			{ "fishbowl.description": buttonHeadPattern },
		],
	};

	let products = await Product.find(productQuery);
	if (limit > 0) products = products.slice(0, limit);

	const enrichmentMap = new Map(
		hexCapEnrichments.map((item) => [String(item.productId), item]),
	);

	const summary = {
		hexCapEnrichments: hexCapEnrichments.length,
		candidateProducts: products.length,
		decodedButtonHead: 0,
		updated: 0,
		skippedUnrecognized: 0,
		skippedNotButtonHead: 0,
		failed: 0,
	};
	const samples = [];

	for (const product of products) {
		try {
			const currentEnrichment = enrichmentMap.get(String(product._id));
			const enrichment = await ProductEnrichment.findById(currentEnrichment?._id);
			if (!enrichment) {
				summary.skippedUnrecognized += 1;
				continue;
			}

			const decoded = decodeCapScrewHeadFamilyFromProduct(
				product.toObject?.() || product,
				enrichment.toObject?.() || enrichment,
			);

			if (!decoded) {
				summary.skippedUnrecognized += 1;
				continue;
			}

			if (decoded.subcategory !== "button head cap screws") {
				summary.skippedNotButtonHead += 1;
				continue;
			}

			summary.decodedButtonHead += 1;

			const partNumber = product?.fishbowl?.partNum || product?.sku || "";
			const title = buildTitle(decoded, partNumber);
			const slug = await buildUniqueSlug({
				title,
				product,
				existingEnrichmentId: enrichment._id,
			});

			const before = {
				title: enrichment.title || "",
				subcategory: enrichment.subcategory || "",
				familyType:
					enrichment?.attributes?.familyType ||
					enrichment?.attributes?.fastenerTypeCanonical ||
					"",
			};

			const nextAttributes = attributesFromDecoded(decoded, product, enrichment.attributes || {});
			enrichment.title = title;
			enrichment.shortTitle = title;
			enrichment.shortDescription = clean(`${title}${partNumber ? ` (${partNumber})` : ""}`);
			enrichment.description = buildDescription(title, decoded, product);
			enrichment.bulletPoints = buildBullets(decoded);
			enrichment.category = "bolts";
			enrichment.subcategory = decoded.subcategory;
			enrichment.attributes = nextAttributes;
			enrichment.tags = uniqueStrings([
				...(Array.isArray(enrichment.tags) ? enrichment.tags : []),
				"bolts",
				slugify(decoded.subcategory),
				slugify(decoded.familyType),
				slugify(decoded.materialFinish),
				decoded.measurementSystem,
			]);
			enrichment.seo = {
				...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
				slug,
				metaTitle: title,
				metaDescription: title,
				keywords: uniqueStrings([
					partNumber,
					decoded.familyType,
					decoded.materialFinish,
					decoded.measurementSystem,
				]),
			};
			enrichment.contentStatus = "ready-review";
			enrichment.markModified("attributes");

			product.hasEnrichment = true;
			product.enrichmentId = enrichment._id;
			product.categoryHints = uniqueStrings(["bolts", decoded.subcategory, decoded.familyType]);
			product.searchKeywords = uniqueStrings([
				...(Array.isArray(product.searchKeywords) ? product.searchKeywords : []),
				partNumber,
				decoded.familyType,
				decoded.subcategory,
				decoded.materialFinish,
			]);

			if (showSamples && samples.length < 30) {
				samples.push({
					partNumber,
					before,
					after: {
						title,
						subcategory: decoded.subcategory,
						familyType: decoded.familyType,
						diameter: decoded.diameter,
						threadPitch: decoded.threadPitch,
						length: decoded.length,
						materialFinish: decoded.materialFinish,
					},
					dryRun,
				});
			}

			if (!dryRun) {
				await enrichment.save();
				await recomputeAndPersistReview(product);
				await product.save();
			}

			summary.updated += 1;
		} catch (err) {
			summary.failed += 1;
			console.error(`Failed for ${product?.sku || product?._id}: ${err.message}`);
		}
	}

	console.log("===== MISFILED BUTTON HEAD CAP SCREW FIX SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Misfiled button head cap screw cleanup failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
