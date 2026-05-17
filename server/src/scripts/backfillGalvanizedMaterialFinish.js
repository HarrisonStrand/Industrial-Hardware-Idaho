import "../config/env.js";
import mongoose from "mongoose";

import ProductEnrichment from "../models/ProductEnrichment.js";

function clean(value = "") {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function normalize(value = "") {
	return clean(value).toLowerCase();
}

function isDryRun() {
	return process.argv.includes("--dry-run");
}

function isSteel(value = "") {
	const normalized = normalize(value);
	return normalized === "steel" || normalized === "carbon steel";
}

function isGalvanizedFinish(value = "") {
	const normalized = normalize(value);
	return (
		normalized === "galvanized" ||
		normalized === "hot dip galvanized" ||
		normalized === "hdg" ||
		normalized === "hot-dip galvanized" ||
		normalized === "hot dipped galvanized"
	);
}

function containsSteelGalvanizedMaterialFinish(value = "") {
	const normalized = normalize(value);
	return (
		normalized === "steel / galvanized" ||
		normalized === "steel/galvanized" ||
		normalized === "steel / hot dip galvanized" ||
		normalized === "steel/hot dip galvanized" ||
		normalized === "steel / hdg" ||
		normalized === "steel/hdg" ||
		normalized === "carbon steel / galvanized" ||
		normalized === "carbon steel / hot dip galvanized"
	);
}

function shouldNormalize(attrs = {}) {
	const material = attrs.material || attrs.displayMaterial || "";
	const finish = attrs.finish || attrs.displayFinish || "";
	const materialFinish = attrs.materialFinish || "";

	return (
		(isSteel(material) && isGalvanizedFinish(finish)) ||
		containsSteelGalvanizedMaterialFinish(materialFinish)
	);
}

function normalizeGalvanized(attrs = {}) {
	return {
		...attrs,
		material: "steel",
		finish: "galvanized",
		displayMaterial: "steel",
		displayFinish: "galvanized",
		materialFinish: "steel / galvanized",
	};
}

function summarizeChange(before = {}, after = {}) {
	return {
		before: {
			material: before.material || "",
			finish: before.finish || "",
			displayMaterial: before.displayMaterial || "",
			displayFinish: before.displayFinish || "",
			materialFinish: before.materialFinish || "",
		},
		after: {
			material: after.material || "",
			finish: after.finish || "",
			displayMaterial: after.displayMaterial || "",
			displayFinish: after.displayFinish || "",
			materialFinish: after.materialFinish || "",
		},
	};
}

async function main() {
	const dryRun = isDryRun();

	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");
	console.log(dryRun ? "🧪 Dry run enabled — no changes will be saved" : "✍️ Saving changes");

	const rows = await ProductEnrichment.find({
		$or: [
			{ "attributes.material": /^(steel|carbon steel)$/i },
			{ "attributes.displayMaterial": /^(steel|carbon steel)$/i },
			{ "attributes.finish": /^(galvanized|hot dip galvanized|hdg|hot-dip galvanized|hot dipped galvanized)$/i },
			{ "attributes.displayFinish": /^(galvanized|hot dip galvanized|hdg|hot-dip galvanized|hot dipped galvanized)$/i },
			{ "attributes.materialFinish": /steel\s*\/\s*(hot dip galvanized|galvanized|hdg)/i },
		],
	})
		.select({
			_id: 1,
			productId: 1,
			title: 1,
			category: 1,
			subcategory: 1,
			attributes: 1,
		})
		.lean(false);

	const summary = {
		scanned: rows.length,
		matched: 0,
		updated: 0,
		alreadyNormalized: 0,
		samples: [],
	};

	for (const enrichment of rows) {
		const attrs = enrichment.attributes || {};
		if (!shouldNormalize(attrs)) continue;

		summary.matched += 1;
		const nextAttrs = normalizeGalvanized(attrs);

		const alreadyNormalized =
			normalize(attrs.material) === "steel" &&
			normalize(attrs.finish) === "galvanized" &&
			normalize(attrs.displayMaterial) === "steel" &&
			normalize(attrs.displayFinish) === "galvanized" &&
			normalize(attrs.materialFinish) === "steel / galvanized";

		if (alreadyNormalized) {
			summary.alreadyNormalized += 1;
			continue;
		}

		if (summary.samples.length < 25) {
			summary.samples.push({
				id: String(enrichment._id),
				productId: String(enrichment.productId || ""),
				title: enrichment.title || "",
				category: enrichment.category || "",
				subcategory: enrichment.subcategory || "",
				...summarizeChange(attrs, nextAttrs),
			});
		}

		if (!dryRun) {
			enrichment.attributes = nextAttrs;
			enrichment.markModified("attributes");
			await enrichment.save();
		}

		summary.updated += 1;
	}

	console.log("===== GALVANIZED MATERIAL FINISH BACKFILL SUMMARY =====");
	console.log(JSON.stringify(summary, null, 2));

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Galvanized material finish backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
