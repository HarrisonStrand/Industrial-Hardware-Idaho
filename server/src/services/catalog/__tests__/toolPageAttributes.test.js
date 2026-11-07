// Run: node --test src/services/catalog/__tests__/toolPageAttributes.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import { handToolType, masonryBitType } from "../toolPageAttributes.js";

test("masonry bit types", () => {
	assert.equal(masonryBitType({ shankSize: "SDS-Plus" }, "SDS-Plus Masonry Drill Bit – 1/4\" x 6\""), "SDS-Plus");
	assert.equal(masonryBitType({ shankSize: "SDS-Max" }, "SDS-Max Masonry Drill Bit – 1\" x 12\""), "SDS-Max");
	assert.equal(masonryBitType({ shankSize: "Straight" }, "Straight Shank Hammer Drill Bit – 1/4\" x 4\""), "Hammer Drill");
	assert.equal(masonryBitType({ shankSize: "A-Taper" }, "A-Taper Shank Masonry Drill Bit"), "Taper Shank");
	assert.equal(masonryBitType({ shankSize: "Spline" }, "Spline Shank Masonry Drill Bit"), "Spline Shank");
	assert.equal(masonryBitType({}, "SDS-Max Scaling Chisel"), "SDS-Max Chisel");
	assert.equal(masonryBitType({}, "SDS-Max to SDS Adapter"), "Adapter");
});

test("hand tool types", () => {
	assert.equal(handToolType({ toolType: "deep impact socket" }), "Sockets");
	assert.equal(handToolType({ toolType: "flex head ratchet" }), "Ratchets & Accessories");
	assert.equal(handToolType({ toolType: "spiral ratchet screwdriver" }), "Screwdrivers");
	assert.equal(handToolType({ toolType: "crowfoot wrench" }), "Wrenches");
	assert.equal(handToolType({ toolType: "hex key set" }), "Hex & Torx Keys");
	assert.equal(handToolType({ toolType: "utility knife blade" }), "Knives & Blades");
	assert.equal(handToolType({ toolType: "paint brush" }), "Brushes");
	assert.equal(handToolType({ toolType: "locking bar clamp" }), "Clamps");
	assert.equal(handToolType({ toolType: "tie wire reel" }), "Other");
	assert.equal(handToolType({}, "DEWALT Blue Marking Chalk"), "Measuring & Marking");
});
