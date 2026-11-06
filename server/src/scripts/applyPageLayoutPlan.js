// Launch step: write the page layout plan (src/services/catalog/pageLayoutPlan.json) to the live
// layout records.
//
//   npm run layout:plan              dry run (default): reads only, prints current vs planned per page
//   npm run layout:plan -- --apply   writes displayMode and fallbackMode, nothing else, then a summary
//
// Only displayMode and fallbackMode change, with one updateOne per page. Visibility (isVisible), cart,
// pricing, images and the global builder switch are left alone. A page with no layout record yet is
// reported and skipped (the server creates missing records with defaults when it starts; run this again).

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

if (process.env.CATALOG_PREVIEW) {
	console.error(
		"Refusing to run: CATALOG_PREVIEW is set. The draft preview guard blocks every database write. " +
			"Run this from a normal shell without CATALOG_PREVIEW.",
	);
	process.exit(1);
}

const apply = process.argv.includes("--apply");

// A dry run must not build indexes or create collections either.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const { default: CatalogSubcategorySetting } = await import("../models/CatalogSubcategorySetting.js");
const { readPageLayoutPlan } = await import("../services/catalog/catalogLayoutDefaults.js");

function pad(text, width) {
	const value = String(text);
	return value.length >= width ? value : value + " ".repeat(width - value.length);
}

async function run() {
	const plan = readPageLayoutPlan();
	const planKeys = Object.keys(plan);
	if (!planKeys.length) throw new Error("The page layout plan is empty or unreadable.");
	if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in .env");

	await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

	const stored = await CatalogSubcategorySetting.find({})
		.select("categoryId subcategoryId displayMode fallbackMode isVisible")
		.lean();
	const byKey = new Map(stored.map((setting) => [`${setting.categoryId}/${setting.subcategoryId}`, setting]));

	console.log(apply ? "APPLY: writing displayMode and fallbackMode" : "DRY RUN: nothing is written (add --apply to write)");
	console.log(
		`${pad("page", 58)} ${pad("current (display / fallback)", 32)} ${pad("planned", 28)} action`,
	);

	const summary = { changed: 0, unchanged: 0, missingRecord: 0, failed: 0, hiddenStaysHidden: 0 };
	const toWrite = [];

	for (const key of planKeys) {
		const planned = plan[key];
		const current = byKey.get(key);
		const plannedText = `${planned.displayMode} / ${planned.fallbackMode}`;

		if (!current) {
			summary.missingRecord += 1;
			console.log(`${pad(key, 58)} ${pad("(no record)", 32)} ${pad(plannedText, 28)} skip: no record`);
			continue;
		}

		const currentText = `${current.displayMode || "-"} / ${current.fallbackMode || "-"}`;
		const same = current.displayMode === planned.displayMode && current.fallbackMode === planned.fallbackMode;
		if (current.isVisible === false) summary.hiddenStaysHidden += 1;
		const note = current.isVisible === false ? " (page stays hidden)" : "";

		if (same) {
			summary.unchanged += 1;
			console.log(`${pad(key, 58)} ${pad(currentText, 32)} ${pad(plannedText, 28)} unchanged${note}`);
			continue;
		}

		toWrite.push({ key, current, planned });
		console.log(`${pad(key, 58)} ${pad(currentText, 32)} ${pad(plannedText, 28)} ${apply ? "write" : "would write"}${note}`);
	}

	const notInPlan = stored
		.map((setting) => `${setting.categoryId}/${setting.subcategoryId}`)
		.filter((key) => !plan[key]);

	if (apply) {
		for (const { key, current, planned } of toWrite) {
			try {
				const result = await CatalogSubcategorySetting.updateOne(
					{ categoryId: current.categoryId, subcategoryId: current.subcategoryId },
					{ $set: { displayMode: planned.displayMode, fallbackMode: planned.fallbackMode } },
				);
				if (result.matchedCount === 1) summary.changed += 1;
				else {
					summary.failed += 1;
					console.error(`  ${key}: no record matched`);
				}
			} catch (error) {
				summary.failed += 1;
				console.error(`  ${key}: ${error.message}`);
			}
		}
	} else {
		summary.changed = toWrite.length;
	}

	const counts = {};
	for (const key of planKeys) counts[plan[key].displayMode] = (counts[plan[key].displayMode] || 0) + 1;

	console.log("");
	console.log(`Plan: ${planKeys.length} pages (${Object.entries(counts).map(([mode, n]) => `${n} ${mode}`).join(", ")})`);
	console.log(`${apply ? "Written" : "Would write"}: ${summary.changed}   unchanged: ${summary.unchanged}   no record: ${summary.missingRecord}   failed: ${summary.failed}`);
	console.log(`Hidden pages in the plan (isVisible false, not changed by this script): ${summary.hiddenStaysHidden}`);
	if (notInPlan.length) console.log(`Layout records not in the plan, left as they are: ${notInPlan.join(", ")}`);
	if (apply) console.log(`Applied at ${new Date().toISOString()} (UTC).`);
	if (summary.failed) process.exitCode = 1;
}

try {
	await run();
} catch (error) {
	console.error("Page layout plan failed:", error.message);
	process.exitCode = 1;
} finally {
	await mongoose.disconnect();
}
