// Run: node --test src/services/catalog/__tests__/priceChangeRules.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRunLimits,
  classifyPriceChange,
  pickFishbowlPrice,
  toPrice,
} from "../../fishbowl/priceChangeRules.js";

test("no change when the price is the same to the cent", () => {
  assert.equal(classifyPriceChange(32.2, "32.2").action, "same");
  assert.equal(classifyPriceChange(32.2, 32.201).action, "same");
});

test("normal changes go live on their own", () => {
  assert.equal(classifyPriceChange(32.2, 33.5).action, "apply");
  assert.equal(classifyPriceChange(10, 15).action, "apply"); // exactly 50%
  assert.equal(classifyPriceChange(10, 5).action, "apply");
});

test("big swings wait for an admin", () => {
  const up = classifyPriceChange(10, 15.01);
  assert.equal(up.action, "hold");
  assert.match(up.reason, /rises 50%/);
  assert.equal(classifyPriceChange(10, 4.99).action, "hold");
  assert.equal(classifyPriceChange(32.2, 161).action, "hold");
});

test("a drop to $0 and a first price wait for an admin", () => {
  assert.deepEqual(classifyPriceChange(32.2, 0), { action: "hold", reason: "Price drops to $0" });
  assert.equal(classifyPriceChange(null, 12).action, "hold");
  assert.equal(classifyPriceChange(0, 12).action, "hold");
});

test("missing or bad Fishbowl prices are skipped, never written", () => {
  for (const bad of [null, undefined, "", "abc", -1]) {
    assert.equal(classifyPriceChange(5, bad).action, "skip");
  }
  assert.equal(classifyPriceChange(0, 0).action, "same");
});

test("the whole run stops when Fishbowl looks wrong", () => {
  assert.match(checkRunLimits({ matched: 4000, expected: 16000, changing: 10 }), /matched only/);
  assert.match(checkRunLimits({ matched: 16000, expected: 16000, changing: 5000 }), /would change at once/);
  assert.equal(checkRunLimits({ matched: 16000, expected: 16000, changing: 300 }), "");
  assert.equal(checkRunLimits({ matched: 0, expected: 0, changing: 0 }), "");
});

test("the Fishbowl product numbered like the part wins", () => {
  const rows = [{ number: "X-YL", price: "0" }, { number: "X", price: "32.2" }];
  assert.equal(pickFishbowlPrice(rows, "X"), 32.2);
  assert.equal(pickFishbowlPrice([{ number: "OTHER", price: "4" }], "X"), 4);
  assert.equal(pickFishbowlPrice([], "X"), null);
  assert.equal(toPrice("5.724"), 5.724);
});

test("the nightly run is the next time the clock reads the set hour (UTC)", async () => {
  const { nextRunTime } = await import("../../fishbowl/fishbowlPriceSyncScheduler.js");
  assert.equal(nextRunTime(9, new Date("2026-11-06T08:00:00Z")).toISOString(), "2026-11-06T09:00:00.000Z");
  assert.equal(nextRunTime(9, new Date("2026-11-06T09:00:00Z")).toISOString(), "2026-11-07T09:00:00.000Z");
  assert.equal(nextRunTime(9, new Date("2026-11-06T22:30:00Z")).toISOString(), "2026-11-07T09:00:00.000Z");
});
