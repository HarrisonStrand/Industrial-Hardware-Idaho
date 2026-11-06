// Run: node --test src/services/catalog/__tests__/fixedPriceGroups.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FIXED_PRICE_GROUPS,
  findFixedPriceGroup,
  normalizeGroupKey,
  priceGroupInfo,
  sanitizeFixedPriceGroups,
} from "../../../config/fixedPriceGroups.js";
import { applyPriceMultiplier } from "../../../utils/resolveProductPrice.js";

const groups = DEFAULT_FIXED_PRICE_GROUPS;

test("names compare the same however they are written", () => {
  assert.equal(normalizeGroupKey("Bits & Drivers"), normalizeGroupKey("bits-and-drivers"));
  assert.equal(normalizeGroupKey("  Big   Timber "), "big timber");
});

test("strut, Diablo and Makita match by category", () => {
  assert.equal(findFixedPriceGroup({ category: "strut", makers: [] }, groups)?.label, "Strut");
  assert.equal(findFixedPriceGroup({ category: "Diablo", makers: [] }, groups)?.label, "Diablo");
  assert.equal(findFixedPriceGroup({ category: "makita", makers: [] }, groups)?.label, "Makita");
});

test("Big Timber matches by maker, brand or vendor", () => {
  const info = priceGroupInfo({ brand: "", vendor: "" }, { category: "screws", manufacturer: { name: "Big Timber" } });
  assert.equal(findFixedPriceGroup(info, groups)?.label, "Big Timber");
  const byVendor = priceGroupInfo({ vendor: "big timber" }, { category: "screws" });
  assert.equal(findFixedPriceGroup(byVendor, groups)?.label, "Big Timber");
});

test("other products are not in a group", () => {
  assert.equal(findFixedPriceGroup({ category: "bolts", makers: ["Brighton-Best International"] }, groups), null);
  assert.equal(findFixedPriceGroup({ category: "strut accessories", makers: [] }, groups), null);
  assert.equal(findFixedPriceGroup({}, groups), null);
  assert.equal(findFixedPriceGroup({ category: "strut" }, []), null);
});

test("sanitize keeps good groups, drops bad ones and repeats", () => {
  const out = sanitizeFixedPriceGroups([
    { type: "category", value: "Strut" },
    { type: "category", value: "strut" },
    { type: "color", value: "red" },
    { type: "maker", value: "" },
    { type: "maker", value: "Big Timber", multiplier: -2 },
  ]);
  assert.deepEqual(out.map((g) => [g.type, g.value, g.multiplier]), [
    ["category", "Strut", 1],
    ["maker", "Big Timber", 1],
  ]);
  assert.equal(sanitizeFixedPriceGroups(undefined).length, DEFAULT_FIXED_PRICE_GROUPS.length);
  assert.deepEqual(sanitizeFixedPriceGroups([]), []);
});

test("a fixed-price product ignores the account markup; others use it", () => {
  const retailX5 = { multiplier: 5, label: "Retail", approvedType: "RETAIL" };
  const strut = { category: "strut", makers: [] };
  const bolt = { category: "bolts", makers: [] };
  assert.equal(applyPriceMultiplier(32.2, retailX5, strut, groups).resolvedPrice, 32.2);
  assert.equal(applyPriceMultiplier(32.2, retailX5, strut, groups).fixedPriceGroup, "Strut");
  assert.equal(applyPriceMultiplier(1.1, retailX5, bolt, groups).resolvedPrice, 5.5);
  assert.equal(applyPriceMultiplier(1.1, retailX5, null, groups).resolvedPrice, 5.5);
  // An account's own price multiplier does not change a fixed price either.
  assert.equal(applyPriceMultiplier(32.2, { multiplier: 2, priceMultiplierOverride: 2 }, strut, groups).resolvedPrice, 32.2);
});
