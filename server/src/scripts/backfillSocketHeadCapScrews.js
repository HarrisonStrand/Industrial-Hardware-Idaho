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

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--dry");
const listSamples = args.has("--samples") || args.has("--list");

const SOCKET_PART_PATTERN = /\bSHCS\d{5,8}(?:FLH|F|LH|Z)?\b|\bSSSH\d{5,8}(?:FLH|F|LH)?\b|\bMMSH\d{8}(?:SS|Z)?\b/i;
const SOCKET_TEXT_PATTERN = /\bsocket\s+head\s+cap\s+screw\b|\bsoc\.?\s*hd\.?\s*c\/?s\b|\bshcs\b/i;

function buildCandidateQuery() {
	return {
		$or: [
			{ "fishbowl.partNum": SOCKET_PART_PATTERN },
			{ sku: SOCKET_PART_PATTERN },
			{ internalPartNumber: SOCKET_PART_PATTERN },
			{ "fishbowl.description": SOCKET_PART_PATTERN },
			{ "fishbowl.description": SOCKET_TEXT_PATTERN },
		],
	};
}

function normalize(value = "") {
	return clean(value).toLowerCase();
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

function sanitizeImageEnums(enrichment) {
	if (!enrichment) return;

	const allowedImageStatuses = new Set(["none", "matched", "partial", "needs-cleanup", "approved"]);
	if (!allowedImageStatuses.has(enrichment.imageStatus)) {
		enrichment.imageStatus = enrichment.images?.length ? "matched" : "none";
	}

	const allowedSources = new Set(["vendor", "manual", "generated", "website", "unknown"]);
	if (Array.isArray(enrichment.images)) {
		for (const image of enrichment.images) {
			if (!allowedSources.has(image.source)) {
				image.source = "generated";
			}
		}
	}
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

function isSocketHeadDecoded(decoded = null) {
	return normalize(decoded?.familyType || "") === "socket head cap screw";
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(`${dryRun ? "🧪 Dry run" : "✍️ Applying"} socket head cap screw backfill`);

	const products = await Product.find(buildCandidateQuery());
	console.log(`Found ${products.length} socket-head candidate products`);

	const summary = {
		candidates: products.length,
		decodedSocketHeads: 0,
		updated: 0,
		createdEnrichment: 0,
		blackOxideSteel: 0,
		fineThread: 0,
		movedFromHexCapScrews: 0,
		skippedUnrecognized: 0,
		failed: 0,
		byMeasurementSystem: {},
		byMaterialFinish: {},
	};

	const samples = [];

	for (const product of products) {
		try {
			let enrichment = await ProductEnrichment.findOne({ productId: product._id });
			const decoded = decodeCapScrewHeadFamilyFromProduct(
				product.toObject?.() || product,
				enrichment?.toObject?.() || enrichment,
			);

			if (!isSocketHeadDecoded(decoded)) {
				summary.skippedUnrecognized += 1;
				continue;
			}

			summary.decodedSocketHeads += 1;
			summary.byMeasurementSystem[decoded.measurementSystem || "(blank)"] =
				(summary.byMeasurementSystem[decoded.measurementSystem || "(blank)"] || 0) + 1;
			summary.byMaterialFinish[decoded.materialFinish || "(blank)"] =
				(summary.byMaterialFinish[decoded.materialFinish || "(blank)"] || 0) + 1;
			if (normalize(decoded.materialFinish) === "steel / black oxide") summary.blackOxideSteel += 1;
			if (normalize(decoded.threadSeries) === "fine") summary.fineThread += 1;
			if (normalize(enrichment?.subcategory || "") === "hex cap screws") summary.movedFromHexCapScrews += 1;

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

			const previousAttributes = enrichment.attributes || {};
			const nextAttributes = attributesFromDecoded(decoded, product, previousAttributes);

			enrichment.title = title;
			enrichment.shortTitle = title;
			enrichment.shortDescription = clean(`${title}${partNumber ? ` (${partNumber})` : ""}`);
			enrichment.description = buildDescription(title, decoded, product);
			enrichment.bulletPoints = buildBullets(decoded);
			enrichment.category = "bolts";
			enrichment.subcategory = "socket head cap screws";
			enrichment.attributes = nextAttributes;
			enrichment.tags = [
				"bolts",
				"socket-head-cap-screws",
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
			sanitizeImageEnums(enrichment);

			product.hasEnrichment = true;
			product.enrichmentId = enrichment._id;
			product.categoryHints = ["bolts", "socket head cap screws", decoded.familyType].filter(Boolean);
			product.searchKeywords = [
				...(Array.isArray(product.searchKeywords) ? product.searchKeywords : []),
				partNumber,
				decoded.familyType,
				"socket head cap screws",
				decoded.materialFinish,
			].filter(Boolean);

			if (listSamples && samples.length < 30) {
				samples.push({
					partNumber,
					description: product?.fishbowl?.description || "",
					title,
					measurementSystem: decoded.measurementSystem,
					diameter: decoded.diameter,
					threadPitch: decoded.threadPitch,
					threadSeries: decoded.threadSeries,
					length: decoded.length,
					headProfile: decoded.headProfile,
					materialFinish: decoded.materialFinish,
					previousSubcategory: previousAttributes.subcategoryCanonical || enrichment?.subcategory || "",
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

	console.log("===== SOCKET HEAD CAP SCREW BACKFILL SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Socket head cap screw backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
