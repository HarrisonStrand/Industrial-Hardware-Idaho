import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const showSamples = args.has("--samples");
const includeAlreadyPublished = args.has("--include-published");

function clean(value = "") {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function isNonCoatedBaseMaterial(material = "") {
	return ["stainless steel", "aluminum", "brass", "nylon", "plastic", "silicon bronze"].includes(
		normalize(material),
	);
}

function isValidMeasurementSystem(value = "") {
	const system = normalize(value);
	return ["imperial", "standard", "metric"].includes(system);
}

function hasRequiredHexNutAttributes(enrichment = {}) {
	const attrs = enrichment?.attributes || {};
	const material = attrs.material || "";
	const isImperial = normalize(attrs.measurementSystem || "") === "imperial" || normalize(attrs.measurementSystem || "") === "standard";
	const requiresFinish = !isNonCoatedBaseMaterial(material);

	return Boolean(
		normalize(enrichment.category) === "nuts" &&
			normalize(enrichment.subcategory) === "hex nuts" &&
			["hex nut", "heavy hex nut"].includes(normalize(attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "")) &&
			clean(attrs.diameter || "") &&
			clean(attrs.threadPitch || "") &&
			(!isImperial || clean(attrs.threadSeries || attrs.thread_series || "")) &&
			clean(attrs.material || "") &&
			(!requiresFinish || clean(attrs.finish || "")) &&
			clean(attrs.materialFinish || "") &&
			clean(attrs.grade || "") &&
			isValidMeasurementSystem(attrs.measurementSystem || ""),
	);
}

function summarizeEnrichment(enrichment = {}, product = {}) {
	const attrs = enrichment?.attributes || {};
	return {
		partNumber: clean(attrs.fishbowlPartNum || product?.fishbowl?.partNum || product?.sku || ""),
		title: enrichment.title || enrichment.shortTitle || "",
		category: enrichment.category || "",
		subcategory: enrichment.subcategory || "",
		measurementSystem: attrs.measurementSystem || "",
		diameter: attrs.diameter || "",
		threadPitch: attrs.threadPitch || "",
		threadSeries: attrs.threadSeries || attrs.thread_series || "",
		materialFinish: attrs.materialFinish || "",
		grade: attrs.grade || "",
		wasPublished: Boolean(product?.isPublished),
		catalogStatus: product?.catalogStatus || "",
		reviewStatus: product?.review?.status || "",
	};
}

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");
if (dryRun) console.log("🔎 Dry run only");

const enrichments = await ProductEnrichment.find({
	category: /^nuts$/i,
	subcategory: /^hex nuts$/i,
	$or: [{ "attributes.familyType": /^hex nut$/i }, { "attributes.familyType": /^heavy hex nut$/i }],
}).lean();

const productIds = enrichments.map((item) => item.productId).filter(Boolean);
const products = await Product.find({ _id: { $in: productIds } });
const productMap = new Map(products.map((product) => [String(product._id), product]));

const summary = {
	candidateEnrichments: enrichments.length,
	missingProduct: 0,
	inactiveProduct: 0,
	alreadyPublished: 0,
	missingBuilderRequirements: 0,
	wouldPublish: 0,
	published: 0,
};

const samples = {
	wouldPublish: [],
	published: [],
	alreadyPublished: [],
	missingBuilderRequirements: [],
	inactiveProduct: [],
};

for (const enrichment of enrichments) {
	const product = productMap.get(String(enrichment.productId));
	if (!product) {
		summary.missingProduct += 1;
		continue;
	}

	if (product.isActive === false || product?.fishbowl?.active === false) {
		summary.inactiveProduct += 1;
		if (samples.inactiveProduct.length < 20) samples.inactiveProduct.push(summarizeEnrichment(enrichment, product));
		continue;
	}

	if (product.isPublished && !includeAlreadyPublished) {
		summary.alreadyPublished += 1;
		if (samples.alreadyPublished.length < 20) samples.alreadyPublished.push(summarizeEnrichment(enrichment, product));
		continue;
	}

	if (!hasRequiredHexNutAttributes(enrichment)) {
		summary.missingBuilderRequirements += 1;
		if (samples.missingBuilderRequirements.length < 50) {
			samples.missingBuilderRequirements.push(summarizeEnrichment(enrichment, product));
		}
		continue;
	}

	summary.wouldPublish += 1;
	const sample = summarizeEnrichment(enrichment, product);
	if (samples.wouldPublish.length < 50) samples.wouldPublish.push(sample);

	if (dryRun) continue;

	product.isPublished = true;
	product.catalogStatus = "published";
	product.needsReview = false;
	product.hasEnrichment = true;
	product.review = {
		...(product.review?.toObject?.() || product.review || {}),
		status: "published",
		renderable: true,
		publishReady: true,
		qualityScore: Math.max(Number(product.review?.qualityScore || 0), 92),
		missingRequiredAttributes: [],
		missingRecommendedAttributes: [],
		issues: [],
		publishedAt: new Date(),
	};
	await product.save();

	await ProductEnrichment.updateOne(
		{ _id: enrichment._id },
		{
			$set: {
				contentStatus: "approved",
				"quality.builderReady": true,
				"quality.renderable": true,
				"quality.publishReady": true,
				"quality.completenessScore": 100,
				"quality.missingRequiredAttributes": [],
				"quality.missingRecommendedAttributes": [],
				"quality.issues": [],
				"quality.lastEvaluatedAt": new Date(),
			},
		},
	);

	summary.published += 1;
	if (samples.published.length < 50) samples.published.push(sample);
}

console.log("\n===== PUBLISH HEX NUTS SUMMARY =====");
console.log(JSON.stringify(summary, null, 2));
if (showSamples) {
	console.log("\n===== SAMPLES =====");
	console.log(JSON.stringify(samples, null, 2));
}

await mongoose.disconnect();
console.log("✅ Done");
