import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import evaluateProductPublishReadiness from "../services/catalog/evaluateProductPublishReadiness.js";
import {
	attributesFromDecoded,
	buildTitle,
	decodeCapScrewHeadFamilyFromProduct,
	slugify,
} from "./capScrewHeadFamilyUtils.js";

const dryRun = process.argv.includes("--dry-run");

function buildCandidateQuery() {
	const partPattern = /\b(?:BHCS|SHCS)\d{6,8}(?:FLH|F|LH)?\b|\b(?:SSSB|SSSH)\d{6,8}(?:FLH|F|LH)?\b|\bMMS[BFH]\d{8}(?:SS)?\b/i;
	return {
		$or: [
			{ "fishbowl.partNum": partPattern },
			{ sku: partPattern },
			{ internalPartNumber: partPattern },
			{ "fishbowl.description": partPattern },
		],
	};
}

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

async function buildUniqueSlug({ title = "", product = null, existingEnrichmentId = null }) {
	const baseFromTitle = slugify(title);
	const baseFromPart = slugify(product?.fishbowl?.partNum || "") || slugify(product?.sku || "");
	const fallbackBase = baseFromTitle || baseFromPart || "product";
	const candidates = [
		fallbackBase,
		`${fallbackBase}-${slugify(product?.fishbowl?.partNum || "")}`,
		`${fallbackBase}-${slugify(product?.sku || "")}`,
		slugify(product?.fishbowl?.partNum || ""),
		slugify(product?.sku || ""),
	]
		.filter(Boolean)
		.filter((value, index, arr) => arr.indexOf(value) === index);

	for (const candidate of candidates) {
		const existing = await ProductEnrichment.findOne({ "seo.slug": candidate })
			.select({ _id: 1, productId: 1 })
			.lean();
		if (!existing) return candidate;
		if (existingEnrichmentId && String(existing._id) === String(existingEnrichmentId)) return candidate;
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
	product.catalogStatus = product.isPublished ? "published" : readiness.publishReady ? "ready" : "enriched";
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
		decoded.material ? `Material: ${decoded.material}` : "",
		decoded.finish ? `Finish: ${decoded.finish}` : "",
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
	console.log(`${dryRun ? "🧪 Dry run" : "✍️ Applying"} button/socket/metric-flat cap screw backfill`);

	const products = await Product.find(buildCandidateQuery());
	console.log(`Found ${products.length} candidate products`);

	const summary = {
		candidates: products.length,
		decoded: 0,
		updated: 0,
		createdEnrichment: 0,
		skippedUnrecognized: 0,
		failed: 0,
		bySubcategory: {},
	};
	const samples = [];

	for (const product of products) {
		try {
			let enrichment = await ProductEnrichment.findOne({ productId: product._id });
			const decoded = decodeCapScrewHeadFamilyFromProduct(product.toObject?.() || product, enrichment?.toObject?.() || enrichment);

			if (!decoded) {
				summary.skippedUnrecognized += 1;
				continue;
			}

			summary.decoded += 1;
			summary.bySubcategory[decoded.subcategory] = (summary.bySubcategory[decoded.subcategory] || 0) + 1;
			const partNumber = product?.fishbowl?.partNum || product?.sku || "";
			const title = buildTitle(decoded, partNumber);
			const slug = await buildUniqueSlug({
				title,
				product,
				existingEnrichmentId: enrichment?._id || null,
			});

			if (!enrichment) {
				enrichment = new ProductEnrichment({
					productId: product._id,
					images: [],
				});
				summary.createdEnrichment += 1;
			}

			const nextAttributes = attributesFromDecoded(decoded, product, enrichment.attributes || {});
			enrichment.title = title;
			enrichment.shortTitle = title;
			enrichment.shortDescription = clean(`${title}${partNumber ? ` (${partNumber})` : ""}`);
			enrichment.description = buildDescription(title, decoded, product);
			enrichment.bulletPoints = buildBullets(decoded);
			enrichment.category = "bolts";
			enrichment.subcategory = decoded.subcategory;
			enrichment.attributes = nextAttributes;
			enrichment.tags = [
				"bolts",
				slugify(decoded.subcategory),
				slugify(decoded.familyType),
				slugify(decoded.materialFinish),
				decoded.measurementSystem,
			]
				.filter(Boolean)
				.filter((value, index, arr) => arr.indexOf(value) === index);
			enrichment.seo = {
				...(enrichment.seo?.toObject?.() || enrichment.seo || {}),
				slug,
				metaTitle: title,
				metaDescription: title,
				keywords: [partNumber, decoded.familyType, decoded.materialFinish, decoded.measurementSystem].filter(Boolean),
			};
			enrichment.contentStatus = "ready-review";
			enrichment.markModified("attributes");

			product.hasEnrichment = true;
			product.enrichmentId = enrichment._id;
			product.categoryHints = ["bolts", decoded.subcategory, decoded.familyType].filter(Boolean);
			product.searchKeywords = [
				...(Array.isArray(product.searchKeywords) ? product.searchKeywords : []),
				partNumber,
				decoded.familyType,
				decoded.subcategory,
				decoded.materialFinish,
			].filter(Boolean);

			if (samples.length < 20) {
				samples.push({
					partNumber,
					title,
					subcategory: decoded.subcategory,
					diameter: decoded.diameter,
					length: decoded.length,
					threadPitch: decoded.threadPitch,
					threadSeries: decoded.threadSeries,
					materialFinish: decoded.materialFinish,
					headProfile: decoded.headProfile,
					partNumberAnomaly: decoded.partNumberAnomaly || "",
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

	console.log("===== CAP SCREW HEAD FAMILY BACKFILL SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Cap screw backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
