// Run: node --test src/services/catalog/__tests__/soldByLength.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import { classifySoldByLength, lengthInFeet, pageKeyFor, titleWithoutLength } from "../soldByLength.js";

test("page keys", () => {
	assert.equal(pageKeyFor("wire hardware", "chain"), "wire-hardware/chain");
	assert.equal(pageKeyFor("wire hardware", "cable & wire rope"), "wire-hardware/cable-wire-rope");
	assert.equal(pageKeyFor("electrical", "shrink wrap"), "electrical/shrink-wrap");
});

test("lengths in feet are read and taken out of titles; inches are left alone", () => {
	assert.equal(lengthInFeet("Grade 30 Zinc Proof Coil Chain – 1/4\" x 400 ft"), 400);
	assert.equal(lengthInFeet("Split Wire Loom – 1/2\" ID x 100', Black"), 100);
	assert.equal(lengthInFeet("Zinc Straight Link Machine Chain – #2 (250 ft Roll)"), 250);
	assert.equal(lengthInFeet("Galvanized 7x19 Aircraft Cable – 3/8\" x 5,000 ft"), 5000);
	assert.equal(lengthInFeet("Galvanized 7x7 Aircraft Cable – 1/8\""), null);
	assert.equal(titleWithoutLength("Split Wire Loom – 1/2\" ID x 100', Black"), "Split Wire Loom – 1/2\" ID, Black");
	assert.equal(titleWithoutLength("Battery Cable – 2 AWG, Black, 25'"), "Battery Cable – 2 AWG, Black");
	assert.equal(titleWithoutLength("Expandable PET Sleeving – 3/8\" (Black, 100 ft)"), "Expandable PET Sleeving – 3/8\" (Black)");
	assert.equal(titleWithoutLength("Grade 30 Proof Coil Chain – 3/8\" x 400 ft"), "Grade 30 Proof Coil Chain – 3/8\"");
	assert.equal(titleWithoutLength("Galvanized 7x7 Aircraft Cable – 1/8\""), "Galvanized 7x7 Aircraft Cable – 1/8\"");
});

test("per foot, dual wall pieces, roll twins hidden, lone rolls and assemblies sold as one", () => {
	const rows = [
		{ partNumber: "CHAIN090", title: "Grade 30 Zinc Proof Coil Chain – 1/4\"", price: 6.35 },
		{ partNumber: "CHAIN083", title: "Grade 30 Zinc Proof Coil Chain – 1/4\" x 400 ft", price: 1634.6 },
		{ partNumber: "CHAIN146", title: "Grade 70 Tie Down Chain with Clevis Hooks – 3/8\" x 20 ft", price: 324.45 },
		{ partNumber: "CHAIN034", title: "Zinc Straight Link Machine Chain – #2 (250 ft Roll)", price: 221.85 },
		{ partNumber: "5210201", title: "Battery Cable – 1/0, Red, 25'", price: 7.48 },
		{ partNumber: "5510101", title: "Battery Cable – 1/0, Red, 100'", price: 834.6 },
		{ partNumber: "BAT002", title: "Battery Cable – 4 AWG, 100'", price: 284.24 },
		{ partNumber: "5514105", title: "Battery Cable – 4 AWG, Black, 100'", price: 4.94 },
		{ partNumber: "HSB08DW", title: "Dual Wall Heat Shrink – 1/2\" x 4', Black", price: 17.74 },
		{ partNumber: "LOOM786", title: "Split Wire Loom – 1/2\" ID x 100', Black", price: 1.55 },
	];
	const unit = (pn) => classifySoldByLength(rows).get(pn).unit;
	assert.equal(unit("CHAIN090"), "ft");
	assert.equal(unit("CHAIN083"), "hide");
	assert.equal(classifySoldByLength(rows).get("CHAIN083").twinOf, "CHAIN090");
	assert.equal(unit("CHAIN146"), "each");
	assert.equal(unit("CHAIN034"), "each");
	assert.equal(unit("5210201"), "ft");
	assert.equal(unit("5510101"), "hide");
	assert.equal(unit("BAT002"), "each");
	assert.equal(unit("5514105"), "ft");
	assert.equal(unit("HSB08DW"), "piece");
	assert.equal(unit("LOOM786"), "ft");
});

test("heat shrink rows say single or dual wall", async () => {
	const { withHeatShrinkWall } = await import("../soldByLength.js");
	const rows = withHeatShrinkWall([
		{ name: "Dual Wall Heat Shrink – 1/2\" x 4', Black", attributes: { size: "1/2" } },
		{ name: "Heat Shrink – 3/8\", Black", attributes: { size: "3/8" } },
	]);
	assert.deepEqual(rows.map((r) => r.attributes.wallType), ["Dual Wall", "Single Wall"]);
	assert.equal(rows[0].attributes.size, "1/2");
});

test("rivet flange type from head style or title", async () => {
	const { rivetFlangeType } = await import("../pageAttributes.js");
	assert.equal(rivetFlangeType({ headStyle: "Flange" }, "Steel Large Flange Pop Rivet"), "Large Flange");
	assert.equal(rivetFlangeType({}, "Black Aluminum Large Flange Split-Type Rivet"), "Large Flange");
	assert.equal(rivetFlangeType({ headStyle: "Button" }, "Aluminum Pop Rivet"), "Standard");
	assert.equal(rivetFlangeType({ headStyle: "Flat" }, "Steel Countersunk Pop Rivet"), "Countersunk");
	assert.equal(rivetFlangeType({}, "Aluminum Klamp-Tite Blind Rivet"), "Standard");
});

test("velcro disc grades show their color and sort coarsest first", async () => {
	const { gradeWithColor } = await import("../pageAttributes.js");
	const { sortGeneralChoiceValues } = await import("../builderShaping.js");
	assert.equal(gradeWithColor("Coarse"), "Coarse (Brown)");
	assert.equal(gradeWithColor("very fine"), "Very Fine (Blue)");
	assert.equal(gradeWithColor("Ultra Fine"), "Ultra Fine (Grey)");
	assert.equal(gradeWithColor("Medium"), "Medium (Red)");
	assert.deepEqual(
		sortGeneralChoiceValues(["Ultra Fine (Grey)", "Coarse (Brown)", "Very Fine (Blue)", "Medium (Red)", "Fine (Blue)"], "gritColor", "grade"),
		["Coarse (Brown)", "Medium (Red)", "Fine (Blue)", "Very Fine (Blue)", "Ultra Fine (Grey)"],
	);
});

test("anchor pages: wedge anchor size, shield type, one diameter per size", async () => {
	const { wedgeAnchorSize, shieldType, withCleanDiameter } = await import("../pageAttributes.js");
	assert.equal(wedgeAnchorSize({ diameter: "1/4", threadPitch: "20" }), "1/4-20");
	assert.equal(wedgeAnchorSize({ diameter: "3/8\"", threadPitch: "16" }), "3/8-16");
	assert.equal(shieldType({ anchorType: "double expansion shield" }), "Expansion Shield");
	assert.equal(shieldType({ anchorType: "lag shield" }), "Lag Shield");
	assert.equal(withCleanDiameter([{ attributes: { diameter: "1/4\"" } }])[0].attributes.diameter, "1/4");
});

test("a page filter marked always shows even with one value", async () => {
	const { planGeneralBuilderChoices } = await import("../builderShaping.js");
	const rows = [{ diameter: "4", arborSize: "5/8-11" }, { diameter: "5", arborSize: "5/8-11" }];
	const keys = (filters) => planGeneralBuilderChoices(rows, filters).map((c) => c.key);
	assert.deepEqual(keys([{ key: "diameter" }, { key: "arborSize" }]), ["diameter"]);
	assert.deepEqual(keys([{ key: "diameter" }, { key: "arborSize", always: true }]), ["diameter", "arborSize"]);
});

test("anchor diameters from titles where the stored value is a screw", async () => {
	const { withCleanDiameter } = await import("../pageAttributes.js");
	const one = (attributes, name) => withCleanDiameter([{ attributes, name }])[0].attributes;
	assert.equal(one({ diameter: "10" }, "Plastic Anchor – #8-#10 x 7/8\"").diameter, "#8-#10");
	assert.equal(one({ diameter: "#10" }, "Fluted Plastic Anchor – #10-#12 x 1-1/4\"").diameter, "#10-#12");
	assert.equal(one({ diameter: "32" }, "Hollow Wall Anchor – 1/8\" Short, 6-32 x 1-3/4\" Screw").diameter, "1/8");
	assert.equal(one({ diameter: "1/4", length: "2\"" }, "Hammer Drive Anchor – 1/4\" x 2\"").length, "2");
});
