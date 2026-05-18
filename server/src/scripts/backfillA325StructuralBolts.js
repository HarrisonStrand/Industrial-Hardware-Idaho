import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
	A325_SEARCH_REGEX,
	asObject,
	buildA325NextAttributes,
	buildA325Title,
	clean,
	decodeA325Product,
	sanitizeImageEnums,
} from "./a325StructuralBoltUtils.js";

const dryRun = process.argv.includes("--dry-run");
const showSamples = process.argv.includes("--samples");

function mapReadyStatus(product = {}) {
	if (product?.isPublished) return "published";
	if (product?.review?.status === "approved") return "approved";
	return "ready";
}

function persistReadyReview(product, enrichment) {
	const nextStatus = mapReadyStatus(product);
	const isReadyStatus = nextStatus === "ready" || nextStatus === "approved" || nextStatus === "published";

	product.review = {
		...asObject(product.review?.toObject?.() || product.review),
		status: nextStatus,
		issues: [],
		missingRequiredAttributes: [],
		missingRecommendedAttributes: [],
		renderable: true,
		publishReady: true,
		qualityScore: 100,
		suggestedFamilyKey: "",
		reviewedAt: new Date(),
	};

	product.needsReview = !isReadyStatus;
	product.catalogStatus = product.isPublished ? "published" : "ready";

	enrichment.quality = {
		...asObject(enrichment.quality?.toObject?.() || enrichment.quality),
		builderReady: true,
		renderable: true,
		publishReady: true,
		completenessScore: 100,
		missingRequiredAttributes: [],
		missingRecommendedAttributes: [],
		issues: [],
		similarFamilies: [],
		suggestedFamilyKey: "",
		suggestedFamilyConfidence: 0,
		lastEvaluatedAt: new Date(),
	};

	return nextStatus;
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(dryRun ? "🔎 Dry run only; no changes will be saved" : "✍️ Applying A325 structural bolt backfill");

	const products = await Product.find({
		$or: [
			{ "fishbowl.partNum": A325_SEARCH_REGEX },
			{ sku: A325_SEARCH_REGEX },
			{ internalPartNumber: A325_SEARCH_REGEX },
			{ "fishbowl.description": A325_SEARCH_REGEX },
		],
	}).lean(false);

	const summary = {
		matched: products.length,
		decoded: 0,
		skippedUnrecognized: 0,
		skippedMissingEnrichment: 0,
		updated: 0,
		dryRun,
		missingLengthLeadingZero: 0,
		plain: 0,
		galvanized: 0,
		zinc: 0,
		domestic: 0,
		standard: 0,
		recomputedReady: 0,
		recomputedApproved: 0,
		recomputedPublished: 0,
	};

	const samples = [];

	for (const product of products) {
		const decoded = decodeA325Product(product);
		const partNumber = product?.fishbowl?.partNum || product?.sku || product?.internalPartNumber || "";

		if (!decoded) {
			summary.skippedUnrecognized += 1;
			continue;
		}

		summary.decoded += 1;
		if (decoded.wasMissingLengthLeadingZero) summary.missingLengthLeadingZero += 1;
		if (decoded.finish === "plain") summary.plain += 1;
		if (decoded.finish === "galvanized") summary.galvanized += 1;
		if (decoded.finish === "zinc") summary.zinc += 1;
		if (decoded.origin === "domestic") summary.domestic += 1;
		if (decoded.origin === "standard") summary.standard += 1;

		const enrichment = await ProductEnrichment.findOne({ productId: product._id });
		if (!enrichment) {
			summary.skippedMissingEnrichment += 1;
			continue;
		}

		const previousAttrs = { ...(enrichment.attributes?.toObject?.() || enrichment.attributes || {}) };
		const nextAttrs = buildA325NextAttributes({ product, enrichment, decoded });
		const nextTitle = buildA325Title(decoded, partNumber);

		if (showSamples && samples.length < 30) {
			samples.push({
				partNumber,
				description: product?.fishbowl?.description || "",
				decoded,
				previous: {
					title: enrichment.title || "",
					category: enrichment.category || "",
					subcategory: enrichment.subcategory || "",
					attributes: previousAttrs,
				},
				next: {
					title: nextTitle,
					category: "bolts",
					subcategory: "hex cap screws",
					attributes: nextAttrs,
				},
			});
		}

		if (!dryRun) {
			enrichment.category = "bolts";
			enrichment.subcategory = "hex cap screws";
			enrichment.title = nextTitle;
			enrichment.shortTitle = nextTitle;
			enrichment.shortDescription = clean(`${nextTitle}${partNumber ? ` (${partNumber})` : ""}`);
			enrichment.description = clean(
				`${nextTitle} is an A325 structural bolt prepared for the catalog builder. Detected specs include Diameter: ${decoded.diameter}, Thread Pitch: ${decoded.threadPitch}, Length: ${decoded.length}, Grade: A325, Material: steel, Finish: ${decoded.finish}, Origin: ${decoded.origin}. Fishbowl part number: ${partNumber}.`,
			);
			enrichment.attributes = nextAttrs;
			enrichment.markModified("attributes");

			if (enrichment.seo) {
				enrichment.seo.metaTitle = nextTitle;
				enrichment.seo.metaDescription = nextTitle;
			}

			sanitizeImageEnums(enrichment);
			const status = persistReadyReview(product, enrichment);

			await enrichment.save();
			await product.save();

			if (status === "ready") summary.recomputedReady += 1;
			if (status === "approved") summary.recomputedApproved += 1;
			if (status === "published") summary.recomputedPublished += 1;
		}

		summary.updated += 1;
	}

	console.log("===== A325 STRUCTURAL BOLT BACKFILL SUMMARY =====");
	console.log(JSON.stringify({ summary, samples }, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ A325 backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
