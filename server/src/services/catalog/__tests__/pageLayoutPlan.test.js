// Run: npm --prefix server run test:page-layouts   (node --test, no database needed: the layout models are stubbed)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import CatalogGlobalSetting from "../../../models/CatalogGlobalSetting.js";
import CatalogSubcategorySetting from "../../../models/CatalogSubcategorySetting.js";
import {
	applyLayoutPlan,
	getCatalogGlobalSetting,
	getCatalogSubcategorySetting,
	getKnownCatalogSubcategories,
	previewLayoutSettings,
	readPageLayoutPlan,
	resolveEffectiveCatalogMode,
} from "../catalogLayoutDefaults.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.resolve(__dirname, "../pageLayoutPlan.json");

// Stored records as the live site has them: shaft collars a range list, hex cap screws a builder.
const STORED = [
	{ categoryId: "wire-hardware", subcategoryId: "shaft-collars", displayMode: "range-list", fallbackMode: "range-list", isVisible: true, sortOrder: 1 },
	{ categoryId: "wire-hardware", subcategoryId: "chain-hardware", displayMode: "range-list", fallbackMode: "range-list", isVisible: true, sortOrder: 2 },
	{ categoryId: "bolts", subcategoryId: "hex-cap-screws", displayMode: "builder", fallbackMode: "range-list", isVisible: true, sortOrder: 3 },
	{ categoryId: "abrasives", subcategoryId: "cut-off-wheels", displayMode: "builder", fallbackMode: "range-list", isVisible: false, sortOrder: 4 },
	{ categoryId: "au-ve-co", subcategoryId: "fasteners", displayMode: "builder", fallbackMode: "range-list", isVisible: true, sortOrder: 5 },
];
const GLOBAL_OFF = { key: "default", buildersEnabled: false, cartEnabled: false, checkoutEnabled: false };

const lean = (value) => ({ lean: async () => structuredClone(value), select() { return this; } });
const findStored = (filter = {}) =>
	STORED.find((s) => s.categoryId === filter.categoryId && s.subcategoryId === filter.subcategoryId) || null;

CatalogSubcategorySetting.find = () => lean(STORED);
CatalogSubcategorySetting.findOne = (filter) => {
	const doc = findStored(filter);
	const result = Promise.resolve(doc ? structuredClone(doc) : null);
	result.lean = async () => (doc ? structuredClone(doc) : null);
	return result;
};
CatalogSubcategorySetting.updateOne = async () => ({ acknowledged: true });
CatalogGlobalSetting.updateOne = async () => ({ acknowledged: true });
CatalogGlobalSetting.findOne = () => lean(GLOBAL_OFF);
CatalogGlobalSetting.findOneAndUpdate = async () => structuredClone(GLOBAL_OFF);

function withPreview(on, fn) {
	const before = process.env.CATALOG_PREVIEW;
	if (on) process.env.CATALOG_PREVIEW = "drafts";
	else delete process.env.CATALOG_PREVIEW;
	return Promise.resolve(fn()).finally(() => {
		if (before === undefined) delete process.env.CATALOG_PREVIEW;
		else process.env.CATALOG_PREVIEW = before;
	});
}

test("the plan file covers every page in categories.json: 129 builder, 88 product grid (11 weak pages moved to grid, 2026-11-04; Diablo Drill Bits split into Metal, Wood and Concrete Bits and Quick / Piggyback Connectors and Hose Clamps moved to builder, 2026-11-06)", () => {
	const raw = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
	const known = new Set(getKnownCatalogSubcategories().map((d) => `${d.categoryId}/${d.subcategoryId}`));
	assert.equal(Object.keys(raw).length, 217);
	for (const key of Object.keys(raw)) assert.ok(known.has(key), `unknown page ${key}`);
	const counts = {};
	for (const entry of Object.values(raw)) {
		counts[entry.displayMode] = (counts[entry.displayMode] || 0) + 1;
		assert.equal(entry.fallbackMode, "product-grid");
	}
	assert.deepEqual(counts, { builder: 129, "product-grid": 88 });
	for (const page of ["metal-bits", "wood-bits", "concrete-bits"]) assert.equal(raw[`diablo/${page}`].displayMode, "product-grid");
	assert.equal(raw["diablo/drill-bits"], undefined);
	assert.equal(raw["wire-hardware/shaft-collars"].displayMode, "builder");
	assert.equal(raw["wire-hardware/peg-board-hardware"].displayMode, "product-grid");
	assert.equal(raw["bolts/hex-cap-screws"].displayMode, "builder");
});

test("a bad plan entry is ignored and an unknown fallback becomes product-grid", () => {
	const file = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "plan-")), "plan.json");
	fs.writeFileSync(file, JSON.stringify({
		"a/b": { displayMode: "builder", fallbackMode: "hidden" },
		"a/c": { displayMode: "hidden", fallbackMode: "product-grid" },
		nokey: { displayMode: "builder" },
	}));
	assert.deepEqual(readPageLayoutPlan(file), { "a/b": { displayMode: "builder", fallbackMode: "product-grid" } });
});

test("applyLayoutPlan sets only displayMode and fallbackMode; pages not in the plan are left alone", () => {
	const plan = readPageLayoutPlan();
	const shaft = applyLayoutPlan(STORED[0], plan);
	assert.deepEqual(shaft, { ...STORED[0], displayMode: "builder", fallbackMode: "product-grid" });
	assert.deepEqual(applyLayoutPlan(STORED[4], plan), STORED[4]);
});

test("in preview the plan applies and the builder switch counts as on", async () => {
	await withPreview(true, async () => {
		const settings = await previewLayoutSettings();
		const byKey = Object.fromEntries(settings.map((s) => [`${s.categoryId}/${s.subcategoryId}`, s]));
		assert.equal(byKey["wire-hardware/shaft-collars"].displayMode, "builder");
		assert.equal(byKey["wire-hardware/shaft-collars"].fallbackMode, "product-grid");
		assert.equal(byKey["wire-hardware/peg-board-hardware"].displayMode, "product-grid");
		assert.equal(byKey["abrasives/cut-off-wheels"].isVisible, true);
		assert.equal(byKey["au-ve-co/fasteners"].fallbackMode, "range-list");
		// Pages without a stored record get defaults in memory, with the plan over them.
		assert.equal(byKey["tools/hand-tools"].displayMode, "builder");

		const global = await getCatalogGlobalSetting();
		assert.equal(global.buildersEnabled, true);
		const page = await getCatalogSubcategorySetting("wire-hardware", "shaft-collars");
		assert.equal(resolveEffectiveCatalogMode(page, global), "builder");
	});
});

test("with the preview flag off nothing from the plan applies", async () => {
	await withPreview(false, async () => {
		const page = await getCatalogSubcategorySetting("wire-hardware", "shaft-collars");
		assert.equal(page.displayMode, "range-list");
		assert.equal(page.fallbackMode, "range-list");
		const global = await getCatalogGlobalSetting();
		assert.equal(global.buildersEnabled, false);
		const hex = await getCatalogSubcategorySetting("bolts", "hex-cap-screws");
		// Builders off: the stored fallback, not the plan's product grid.
		assert.equal(resolveEffectiveCatalogMode(hex, global), "range-list");
	});
});
