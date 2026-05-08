import "../config/env.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import ProductEnrichment from "../models/ProductEnrichment.js";

const MANIFEST_PATH = path.resolve(process.cwd(), "data/boltFamilyImageMap.json");

function clean(value = "") {
	return String(value || "").trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function buildLookupKeys(enrichment = {}) {
	const attrs = enrichment?.attributes || {};

	const category = normalize(enrichment?.category || "");
	const subcategory = normalize(enrichment?.subcategory || "");
	const familyType = normalize(attrs.familyType || attrs.fastenerTypeCanonical || attrs.fastenerType || "");
	const grade = normalize(attrs.grade || "");
	const finish = normalize(attrs.finish || "");
	const material = normalize(attrs.material || "");
	const measurementSystem = normalize(attrs.measurementSystem || "");
	const familyKey = normalize(attrs.familyKey || "");
	const familySlug = normalize(attrs.familySlug || "");
	const familyTitle = normalize(attrs.familyTitle || "");

	const keys = [
		familyKey,
		familySlug,
		familyTitle,
		[category, subcategory, familyType, finish, grade, material, measurementSystem].filter(Boolean).join("|"),
		[category, subcategory, familyType, finish, grade].filter(Boolean).join("|"),
		[familyType, finish, grade, material, measurementSystem].filter(Boolean).join("|"),
		[familyType, finish, grade].filter(Boolean).join("|"),
		[familyType, finish, material].filter(Boolean).join("|"),
		[familyType, finish].filter(Boolean).join("|"),
	].filter(Boolean);

	return [...new Set(keys)];
}

async function main() {
	if (!fs.existsSync(MANIFEST_PATH)) {
		throw new Error(`Missing manifest at ${MANIFEST_PATH}`);
	}

	const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const enrichments = await ProductEnrichment.find({
		category: /^bolts$/i,
		subcategory: /^hex cap screws$/i,
	}).lean();

	let matched = 0;
	let updated = 0;
	let unchanged = 0;

	for (const enrichment of enrichments) {
		const keys = buildLookupKeys(enrichment);
		const matchKey = keys.find((key) => manifest[key]);
		if (!matchKey) continue;

		matched += 1;
		const imageUrl = manifest[matchKey];
		const nextImages = [
			{
				url: imageUrl,
				alt: enrichment?.title || enrichment?.attributes?.familyTitle || "Product image",
				isPrimary: true,
				source: "family-manifest",
			},
		];

		const currentImages = Array.isArray(enrichment.images) ? enrichment.images : [];
		const same = currentImages.length === 1 && currentImages[0]?.url === imageUrl && currentImages[0]?.isPrimary === true;

		if (same) {
			unchanged += 1;
			continue;
		}

		await ProductEnrichment.updateOne(
			{ _id: enrichment._id },
			{
				$set: {
					images: nextImages,
					imageStatus: "assigned",
				},
			}
		);

		updated += 1;
	}

	console.log("===== BOLT FAMILY IMAGE SUMMARY =====");
	console.log({
		totalEnrichments: enrichments.length,
		matched,
		updated,
		unchanged,
	});

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
