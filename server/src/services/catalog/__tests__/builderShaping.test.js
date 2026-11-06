// Run: npm --prefix server run test:page-layouts   (node --test, no database needed)
import test from "node:test";
import assert from "node:assert/strict";

import {
	collectGeneralChoiceOptions,
	dedupeGeneralVariants,
	generalSpecKey,
	isHandTunedBuilderPage,
	isInternalBuilderKey,
	planGeneralBuilderChoices,
	shapeGeneralBuilderAttributes,
	sortGeneralChoiceValues,
	unifyChoiceValueCase,
	usesGeneralBuilderShaping,
} from "../builderShaping.js";

// Live attributes as a shaft collar row carries them, internal keys included.
function collar(overrides = {}) {
	return {
		sku: "SC-1/2",
		internalPartNumber: "SC12Z",
		fishbowlPartNum: "SC12Z",
		fishbowlDescription: "SET COLLAR 1/2 ZINC",
		familyKey: "set-collar",
		familySlug: "set-collar",
		familyTitle: "Set Collar",
		fastenerType: "collar",
		fastenerTypeCanonical: "collar",
		categoryCanonical: "wire hardware",
		subcategoryCanonical: "shaft collars",
		measurementSystem: "imperial",
		collarType: "Set Screw",
		size: '1/2"',
		material: "Steel",
		finish: "Zinc",
		...overrides,
	};
}

const INTERNAL = [
	"sku",
	"internalPartNumber",
	"fishbowlPartNum",
	"fishbowlDescription",
	"familyKey",
	"familySlug",
	"familyTitle",
	"fastenerType",
	"fastenerTypeCanonical",
	"categoryCanonical",
	"subcategoryCanonical",
	"slug",
	"partId",
];

test("internal keys are recognised; familyType (a product type) is not", () => {
	for (const key of INTERNAL) assert.equal(isInternalBuilderKey(key), true, key);
	for (const key of ["familyType", "collarType", "diameter", "materialFinish", "color"]) {
		assert.equal(isInternalBuilderKey(key), false, key);
	}
});

test("general attributes drop every internal key and build materialFinish", () => {
	const shaped = shapeGeneralBuilderAttributes(collar());
	for (const key of INTERNAL) assert.equal(key in shaped, false, key);
	assert.equal(shaped.materialFinish, "Steel / Zinc");
	assert.equal(shaped.measurementSystem, "Standard");
	assert.equal(shaped.size, '1/2"');
	assert.equal(shaped.material, "Steel");
});

test("default choices never offer an internal key, even when it varies", () => {
	const rows = [
		collar({ sku: "A", fishbowlPartNum: "A", familyKey: "a", diameter: "1/2", length: "1", color: "Black" }),
		collar({ sku: "B", fishbowlPartNum: "B", familyKey: "b", diameter: "3/4", length: "2", color: "Red" }),
	];
	const choices = planGeneralBuilderChoices(rows, []);
	const keys = choices.map((choice) => choice.key);
	for (const key of INTERNAL) assert.equal(keys.includes(key), false, key);
	assert.deepEqual(keys, ["diameter", "length", "color"]);
});

test("a choice with a single value on the page is dropped", () => {
	const rows = [
		shapeGeneralBuilderAttributes(collar({ size: '1/2"' })),
		shapeGeneralBuilderAttributes(collar({ size: '3/4"' })),
	];
	const keys = planGeneralBuilderChoices(rows, []).map((choice) => choice.key);
	// collarType, measurementSystem, materialFinish are the same on every row.
	assert.deepEqual(keys, ["size"]);
});

test("the type key is the first present, and only when the page has more than one value", () => {
	const rows = [
		{ productType: "Collar", collarType: "Set Screw", diameter: "1/2" },
		{ productType: "Collar", collarType: "Double Split", diameter: "3/4" },
	];
	// productType is present first but has one value, so no type choice (collarType is not taken instead).
	assert.deepEqual(planGeneralBuilderChoices(rows, []).map((c) => c.key), ["diameter"]);
	rows[1].productType = "Clamp";
	assert.deepEqual(planGeneralBuilderChoices(rows, []).map((c) => c.key), ["productType", "diameter"]);
});

test("default choices follow buyer order with readable labels", () => {
	const rows = [
		{ hardwareType: "Hook", measurementSystem: "Standard", threadSize: "1/4-20", threadPitch: "20", wireGauge: "10", materialFinish: "Steel / Zinc", grade: "2", color: "Black" },
		{ hardwareType: "Eye", measurementSystem: "Metric", threadSize: "M6", threadPitch: "1.0", wireGauge: "12", materialFinish: "Stainless", grade: "5", color: "Red" },
	];
	const choices = planGeneralBuilderChoices(rows, []);
	assert.deepEqual(
		choices.map((c) => c.key),
		["hardwareType", "measurementSystem", "threadSize", "threadPitch", "wireGauge", "materialFinish", "grade", "color"],
	);
	const labels = Object.fromEntries(choices.map((c) => [c.key, c.label]));
	assert.equal(labels.threadPitch, "Thread");
	assert.equal(labels.materialFinish, "Material / Finish");
	assert.equal(labels.wireGauge, "Wire Gauge");
	assert.equal(labels.threadSize, "Thread Size");
});

test("page filters win over the default set, in their order and with their labels", () => {
	const rows = [
		shapeGeneralBuilderAttributes(collar({ collarType: "Set Screw", size: '1/2"', material: "Steel", finish: "Zinc", diameter: "1/2", color: "Black" })),
		shapeGeneralBuilderAttributes(collar({ collarType: "Double Split", size: '3/4"', material: "Stainless Steel", finish: "", diameter: "3/4", color: "Red" })),
	];
	const filters = [
		{ key: "collarType", label: "Collar Type", sort: "" },
		{ key: "size", label: "Bore", sort: "size" },
		{ key: "material", label: "Material", sort: "" },
		{ key: "finish", label: "Finish", sort: "" },
		{ key: "sku", label: "SKU", sort: "" },
	];
	const choices = planGeneralBuilderChoices(rows, filters);
	// diameter and color vary too, but the page's filters decide; finish has one value, sku is internal.
	assert.deepEqual(choices, [
		{ key: "collarType", label: "Collar Type", sort: "" },
		{ key: "size", label: "Bore", sort: "size" },
		{ key: "material", label: "Material", sort: "" },
	]);
});

test("size is dropped when diameter and length already pin it down", () => {
	const rows = [
		{ diameter: "1/8", length: "1", size: "1/8X1" },
		{ diameter: "1/8", length: "2", size: "1/8 X 2" },
		{ diameter: "3/16", length: "1", size: "3/16X1" },
	];
	assert.deepEqual(planGeneralBuilderChoices(rows, []).map((c) => c.key), ["diameter", "length"]);
	// Without a length, a size that says more than the diameter (thickness, arbor) stays.
	const wheels = [
		{ diameter: "4", size: "4 x .035 x 5/8" },
		{ diameter: "4", size: "4 x 1/16 x 3/8" },
		{ diameter: "6", size: "6 x .040 x 7/8" },
	];
	assert.deepEqual(planGeneralBuilderChoices(wheels, []).map((c) => c.key), ["diameter", "size"]);
});

test("sizes sort by value, other choices alphabetically", () => {
	assert.deepEqual(
		sortGeneralChoiceValues(['1"', '1/4"', '1-1/8"', '3/16"', '1/8"'], "size", "size"),
		['1/8"', '3/16"', '1/4"', '1"', '1-1/8"'],
	);
	assert.deepEqual(
		sortGeneralChoiceValues(['1" - 2"', '1/2" - 1-1/4"', '5/16" - 5/8"'], "clampRange"),
		['5/16" - 5/8"', '1/2" - 1-1/4"', '1" - 2"'],
	);
	assert.deepEqual(sortGeneralChoiceValues(["120", "36", "60"], "grit"), ["36", "60", "120"]);
	assert.deepEqual(sortGeneralChoiceValues(["Zinc", "Black", "plain"], "finish"), ["Black", "plain", "Zinc"]);
});

test("values differing only in case read as one choice", () => {
	const rows = [{ materialFinish: "Stainless Steel" }, { materialFinish: "Stainless Steel" }, { materialFinish: "stainless steel" }];
	unifyChoiceValueCase(rows);
	assert.deepEqual(rows.map((row) => row.materialFinish), ["Stainless Steel", "Stainless Steel", "Stainless Steel"]);
});

test("distinct products are never folded, even when they share every choice", () => {
	const choiceKeys = ["collarType", "size"];
	const variants = [
		{ productId: "p1", partNumber: "SC12Z", name: "Zinc Set Collar – 1/2\" Bore", attributes: { collarType: "Set Screw", size: '1/2"' } },
		{ productId: "p2", partNumber: "SC12BO", name: "Black Oxide Set Collar – 1/2\" Bore", attributes: { collarType: "Set Screw", size: '1/2"' } },
		{ productId: "p3", partNumber: "SC12Z-B", name: "Zinc Set Collar – 1/2\" Bore", attributes: { collarType: "Set Screw", size: '1/2"' } },
		{ productId: "p4", partNumber: "SC34Z", name: "Zinc Set Collar – 3/4\" Bore", attributes: { collarType: "Set Screw", size: '3/4"' } },
	];
	const deduped = dedupeGeneralVariants(variants, choiceKeys);
	assert.equal(deduped.length, 4);
	assert.notEqual(generalSpecKey(variants[0], choiceKeys), generalSpecKey(variants[1], choiceKeys));
	const names = deduped.map((variant) => variant.name);
	assert.equal(new Set(names).size, 4, "every card reads differently");
	assert.ok(names.includes('Zinc Set Collar – 1/2" Bore (SC12Z)'));
	assert.ok(names.includes('Black Oxide Set Collar – 1/2" Bore'));
	assert.equal(deduped.find((v) => v.productId === "p4").sharesChoicesWith, undefined);
});

test("the same product listed twice still folds into one variant", () => {
	const variants = [
		{ productId: "p1", partNumber: "A", name: "A", attributes: { size: "1" } },
		{ productId: "p1", partNumber: "A", name: "A", attributes: { size: "1" } },
	];
	const deduped = dedupeGeneralVariants(variants, ["size"]);
	assert.equal(deduped.length, 1);
	assert.equal(deduped[0].duplicateCount, 2);
});

test("choice options list each choice's values, sorted", () => {
	const variants = [{ attributes: { size: '3/4"' } }, { attributes: { size: '1/4"' } }, { attributes: { size: "" } }];
	assert.deepEqual(collectGeneralChoiceOptions(variants, [{ key: "size", sort: "size" }]), { size: ['1/4"', '3/4"'] });
});

test("general shaping is preview only and never touches a hand-tuned page", () => {
	assert.equal(usesGeneralBuilderShaping("shaft collars", false), true);
	assert.equal(usesGeneralBuilderShaping("shaft collars", true), true);
	for (const sub of ["hex cap screws", "hex-nuts", "flat washers", "lock washers", "fender washers", "flange bolts", "hanger bolts", "machine screws", "sheet metal screws", "threaded rod"]) {
		assert.equal(isHandTunedBuilderPage(sub), true, sub);
		assert.equal(usesGeneralBuilderShaping(sub, true), false, sub);
	}
});

test("a stray thread pitch on unthreaded rows is not offered in the default set", () => {
	const ties = [
		{ length: "8", threadPitch: "1", color: "Black" },
		{ length: "11", threadPitch: "3", color: "White" },
		{ length: "14", color: "Black" },
	];
	assert.deepEqual(planGeneralBuilderChoices(ties, []).map((c) => c.key), ["length", "color"]);
	const bolts = [
		{ diameter: "1/4", threadPitch: "20" },
		{ diameter: "1/4", threadPitch: "28" },
	];
	assert.deepEqual(planGeneralBuilderChoices(bolts, []).map((c) => c.key), ["threadPitch"]);
	// A page filter for threadPitch is kept as set.
	assert.deepEqual(planGeneralBuilderChoices(ties, [{ key: "threadPitch", label: "Pitch" }]).map((c) => c.key), ["threadPitch"]);
});

test("on a general page a bare diameter is a plain number, not a screw gauge", () => {
	assert.deepEqual(
		sortGeneralChoiceValues(["3", "4", "12", "4-1/2", "9", "14"], "diameter", "size"),
		["3", "4", "4-1/2", "9", "12", "14"],
	);
	assert.deepEqual(sortGeneralChoiceValues(["1/4", "#10", "#6"], "diameter"), ["#6", "#10", "1/4"]);
});

test("wire gauge sorts thinnest wire first; stud size smallest first, numbered sizes before inches", async () => {
	const { sortGeneralChoiceValues } = await import("../builderShaping.js");
	assert.deepEqual(
		sortGeneralChoiceValues(["2", "8", "12-10", "22-18", "16-14", "22-16", "4"], "wireGauge", "gauge"),
		["22-18", "22-16", "16-14", "12-10", "8", "4", "2"],
	);
	assert.deepEqual(
		sortGeneralChoiceValues(['1/4"', '3/8"', "#10", "#6", '5/16"', "#8"], "studSize", "stud"),
		["#6", "#8", "#10", '1/4"', '5/16"', '3/8"'],
	);
});
