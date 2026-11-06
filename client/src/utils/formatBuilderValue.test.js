// Run: npm --prefix client run test:builder-values
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBuilderValue as f, systemForRows, titleEvidence } from "./formatBuilderValue.js";

test("inch numbers on measurement keys get the mark", () => {
	assert.equal(f("length", "6", "imperial"), '6"');
	assert.equal(f("length", "1/4", "Standard"), '1/4"');
	assert.equal(f("length", "1-1/2", ""), '1-1/2"');
	assert.equal(f("length", "1 5/8", "Standard"), '1 5/8"');
	assert.equal(f("thickness", ".045", "Standard"), '.045"');
	assert.equal(f("diameter", "3", "Standard"), '3"');
	for (const key of ["width", "bore", "size", "insideDiameter", "outsideDiameter", "overallLength", "arborSize", "studSize"]) {
		assert.equal(f(key, "3/4", "Standard"), '3/4"', key);
	}
});

test("multi-part sizes mark each clearly-inch number", () => {
	assert.equal(f("size", "4-1/2 x .045 x 7/8", "Standard"), '4-1/2" x .045" x 7/8"');
	assert.equal(f("size", "1 x 1 x 1/4", "Standard"), '1" x 1" x 1/4"');
	assert.equal(f("size", "1/4 X 6", "Standard"), '1/4" X 6"');
	// Whole numbers alone in a multi-part size are not clearly inches (tarps are feet).
	assert.equal(f("size", "12 x 14", "Standard", { titles: ["Blue Tarp – 12 x 14"] }), "12 x 14");
	assert.equal(f("size", "12 x 14", "Standard", { titles: ['Bag – 12" x 14"'] }), '12" x 14"');
	// A screw gauge in front of a length stays bare.
	assert.equal(f("size", "8X2-3/8", "Standard", { titles: ['#8 x 2-3/8" Screw'] }), '8X2-3/8"');
	assert.equal(f("size", "#10 x 1/2", "Standard"), '#10 x 1/2"');
});

test("thread designations mark the diameter only", () => {
	assert.equal(f("arbor", "5/8-11", "Standard"), '5/8"-11');
	assert.equal(f("threadSize", "1/4-20", "Standard"), '1/4"-20');
	assert.equal(f("threadSize", "#10-24", "Standard"), "#10-24");
});

test("never on non-measure keys", () => {
	for (const key of ["threadPitch", "tpi", "teethPerInch", "wireGauge", "gauge", "grit", "grade", "packageQuantity", "toothCount", "materialFinish", "thread"]) {
		assert.equal(f(key, "13", "imperial"), "13", key);
		assert.equal(f(key, "1/2", "imperial"), "1/2", key);
	}
});

test("never on metric rows or metric values", () => {
	assert.equal(f("length", "20", "metric"), "20");
	assert.equal(f("length", "4.2", "Metric"), "4.2");
	assert.equal(f("length", "1/2", "metric"), "1/2");
	assert.equal(f("diameter", "M6", "Standard"), "M6");
	assert.equal(f("diameter", "16.2MM", ""), "16.2MM");
	assert.equal(f("size", "20mm", "Standard"), "20mm");
});

test("values that already carry a unit, or are text, are left alone", () => {
	for (const value of ["6'", "3 ft", '1/2"', '1-1/2"', "50 yd", "520 in", '16" x 16"', "20' x 100'", "Large", "2XL", "T-10", "10 lb", "200 count"]) {
		assert.equal(f("size", value, "Standard"), value, value);
	}
});

test("gauges and odd numbers stay bare", () => {
	assert.equal(f("diameter", "#8", "Standard"), "#8");
	assert.equal(f("diameter", "#8-10", "Standard"), "#8-10");
	assert.equal(f("size", "1/0", "Standard"), "1/0"); // chain trade size
	assert.equal(f("length", "0", "Standard"), "0");
	assert.equal(f("diameter", "035", "Standard"), "035");
	assert.equal(f("length", "8059957", "Standard"), "8059957");
	assert.equal(f("length", "3-1", "Standard"), "3-1");
});

test("titles decide bare numbers", () => {
	assert.equal(f("length", "6", "imperial", { titles: ['Hex Cap Screw – 7/16"-14 x 6"'] }), '6"');
	assert.equal(f("length", "500", "Standard", { titles: ["Primary Wire – 14 AWG, Black, 500'"] }), "500");
	assert.equal(f("size", "10", "Standard", { titles: ['Neoprene Bonded Sealing Washer – #10 x 1/2"'] }), "10");
	assert.equal(f("diameter", "24", "Standard", { titles: ['Metal Thread Insert – #10-24, 3/8" External'] }), "24");
	assert.equal(f("thickness", "1.4", "Standard", { titles: ["Washer 1.4mm"] }), "1.4");
	// No evidence either way: a bare whole number on an inch row is inches.
	assert.equal(f("length", "2", "imperial", { titles: ["Something"] }), '2"');
});

test("mixed and unknown systems", () => {
	assert.equal(f("length", "10", "mixed"), '10" / 10mm');
	assert.equal(f("length", "1/2", "mixed"), '1/2"');
	assert.equal(f("size", "12 x 14", "mixed"), "12 x 14");
	assert.equal(f("length", "10", "unknown"), "10");
	assert.equal(f("length", "1/2", "unknown"), '1/2"');
	assert.equal(systemForRows(["imperial", "metric"]), "mixed");
	assert.equal(systemForRows(["Metric"]), "metric");
	assert.equal(systemForRows(["Standard", ""]), "imperial");
});

test("empty and non-string values", () => {
	assert.equal(f("length", "", "imperial"), "");
	assert.equal(f("length", null, "imperial"), "");
	assert.equal(f("length", 6, "imperial"), '6"');
	assert.equal(titleEvidence("6", []), "none");
});
