// Run: node --test src/services/catalog/__tests__/wireHardwareAttributes.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import { chainHardwareType, clevisPinType, keyType, screwEyeWire, titleFinish, wireLockPinType } from "../wireHardwareAttributes.js";

test("material / finish from the title's leading words", () => {
	assert.equal(titleFinish("Zinc Clevis Pin – 3/8\" x 1-1/16\""), "Zinc Plated");
	assert.equal(titleFinish("316 Stainless Steel Forged Machine Eye Bolt with Shoulder – 1/2\""), "316 Stainless Steel");
	assert.equal(titleFinish("Hot-Dip Galvanized Forged Machine Eye Bolt with Shoulder"), "Hot-Dip Galvanized");
	assert.equal(titleFinish("Plain Steel Square Key Stock – 1/4\""), "Plain Steel");
	assert.equal(titleFinish("Forged Machine Eye Bolt – 1/2\"", "Steel / Zinc"), "Zinc Plated");
	assert.equal(titleFinish("Detent Ring Pin – 1/2\"", ""), "");
	assert.equal(titleFinish("Steel Rectangular Key Stock – 1/4\""), "Plain Steel");
	assert.equal(titleFinish("Woodruff Key – #3", "Steel / Plain"), "Plain Steel");
	assert.equal(titleFinish("Hitch Pin Clip – .120\"", "Steel / Yellow Zinc"), "Yellow Zinc");
});

test("types from titles", () => {
	assert.equal(clevisPinType("Stainless Steel Detent Ring Pin – 1/4\""), "Detent Ring Pin");
	assert.equal(clevisPinType("Adjustable Yoke End – 3/4\"-16"), "Yoke End");
	assert.equal(clevisPinType("Headless Grooved Clevis Pin – 1/4\""), "Clevis Pin");
	assert.equal(keyType("Stainless Steel Woodruff Key – #3"), "Woodruff Key");
	assert.equal(keyType("Steel Rectangular Key Stock – 1/4\" x 3/8\""), "Rectangular Key Stock");
	assert.equal(keyType("Brass Square Key Stock – 1/4\""), "Square Key Stock");
	assert.equal(chainHardwareType("Clevis Grab Hook – 3/8\"", "clevis grab hook"), "Hooks");
	assert.equal(chainHardwareType("Galvanized Screw Pin Shackle – 1/2\"", "screw pin shackle"), "Shackles");
	assert.equal(chainHardwareType("Repair Link (Lap Link) – 1/4\"", ""), "Links");
	assert.equal(chainHardwareType("Rebar Tie Wire", "rebar tie wire"), "Rebar Tie Wire");
	assert.equal(wireLockPinType("Square Wire Lock Pin – 3/8\" x 2-1/2\""), "Square");
	assert.equal(wireLockPinType("Round Wire Lock Pin – 1/4\" x 2\""), "Round");
	assert.equal(screwEyeWire("Zinc Plated Screw Eye – 15/16\", .080\" Wire"), ".080");
	assert.equal(screwEyeWire("Zinc Plated Screw Eye – 5/8\""), "");
});
