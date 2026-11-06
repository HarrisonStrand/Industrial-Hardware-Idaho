// Run: node --test src/services/catalog/__tests__/fishbowlPricingRules.test.js   (no database)
// Rule numbers below are the real Fishbowl rules the decoding was checked against.
import test from "node:test";
import assert from "node:assert/strict";
import {
	categoriesWithParents,
	priceFromRules,
	rulePrice,
	websiteGroupFor,
	websiteRulePrices,
} from "../../fishbowl/fishbowlPricingRules.js";

const tree = new Map([
	[1, { id: 1, parentId: 0 }],
	[411, { id: 411, parentId: 1 }], // PRICING MASTER
	[412, { id: 412, parentId: 411 }], // FASTENERS
	[268, { id: 268, parentId: 412 }], // D&T
	[400, { id: 400, parentId: 1 }], // Retail Fasteners
	[385, { id: 385, parentId: 1 }], // FREUD AMERICA INC (Diablo)
]);

const all = { isActive: true, isAutoApply: true, isTier2: false, qtyApplies: false, dateApplies: false };
const rules = [
	{ ...all, id: 754, name: "RETAIL CUSTOMER - Fasteners", paTypeId: 3, paBaseAmountTypeId: 6, paPercent: 0.8, customerInclTypeId: 3, customerInclId: 6, productInclTypeId: 3, productInclId: 400 },
	{ ...all, id: 784, name: "HOUSE ACCOUNT FASTNERS", paTypeId: 3, paBaseAmountTypeId: 6, paPercent: 0.62, customerInclTypeId: 3, customerInclId: 7, productInclTypeId: 3, productInclId: 400 },
	{ ...all, id: 787, name: "GOLD Standard Fasteners", paTypeId: 3, paBaseAmountTypeId: 6, paPercent: 0.62, customerInclTypeId: 3, customerInclId: 24, productInclTypeId: 3, productInclId: 412 },
	{ ...all, id: 514, name: "ICE MELT - PURPLE HEAT", paTypeId: 6, paBaseAmountTypeId: 6, paPercent: 0.45, paAmount: 11.35, customerInclTypeId: 1, productInclTypeId: 2, productInclId: 900 },
	{ ...all, id: 558, name: "RAGS 50# BUNDLE COLOR", paTypeId: 2, paBaseAmountTypeId: 6, paPercent: 0.45, customerInclTypeId: 1, productInclTypeId: 2, productInclId: 901 },
	{ ...all, id: 728, name: "DIABLO RETAIL PRICING 2025", paTypeId: 5, paBaseAmountTypeId: 5, paPercent: 0, paAmount: 0, customerInclTypeId: 1, productInclTypeId: 3, productInclId: 385 },
	{ ...all, id: 701, name: "ACCO FIXED AT", paTypeId: 2, paBaseAmountTypeId: 6, paPercent: 0.5, customerInclTypeId: 2, customerInclId: 3110, productInclTypeId: 3, productInclId: 400 },
	{ ...all, id: 304, name: "RETAIL CUSTOMER - Metric", isTier2: true, paTypeId: 3, paBaseAmountTypeId: 6, paPercent: 0.85, customerInclTypeId: 3, customerInclId: 6, productInclTypeId: 3, productInclId: 400 },
];

const bolt = { fishbowlProductId: 1, listPrice: 0.1627, stdCost: 0.11, avgCost: 0.08, treeIds: [400] };

test("account types map to Fishbowl groups", () => {
	assert.equal(websiteGroupFor("RETAIL"), "RETAIL");
	assert.equal(websiteGroupFor("HOUSE"), "HOUSE");
	assert.equal(websiteGroupFor("NET30"), "HOUSE");
	assert.equal(websiteGroupFor(undefined), "RETAIL");
});

test("a category rule covers every category under it", () => {
	assert.deepEqual([...categoriesWithParents([268], tree)].sort((a, b) => a - b), [1, 268, 411, 412]);
});

test("decoded rule kinds give the prices Fishbowl charged", () => {
	assert.equal(rulePrice(rules[3], {}), 11.35); // fixed
	assert.equal(rulePrice(rules[4], { stdCost: 38.88 }), 56.376); // markup on cost
	assert.equal(rulePrice({ ...rules[0], paPercent: 0.4 }, { stdCost: 74.46 }), 124.1); // margin on cost
	assert.equal(rulePrice(rules[5], { listPrice: 30.98 }), 30.98); // Diablo: list price as is
});

test("hanger bolt: Retail = cost x 5, House = cost / 0.38", () => {
	const prices = websiteRulePrices(bolt, rules, tree);
	assert.equal(prices.RETAIL.price, 0.55);
	assert.equal(prices.RETAIL.ruleName, "RETAIL CUSTOMER - Fasteners");
	assert.equal(prices.HOUSE.price, 0.2895);
});

test("tier-1 rules win over tier-2 rules", () => {
	assert.equal(priceFromRules(bolt, rules, tree, { groupId: 6 }).ruleId, 754);
	const onlyTier2 = rules.filter((r) => r.id !== 754);
	assert.equal(priceFromRules(bolt, onlyTier2, tree, { groupId: 6 }).ruleId, 304);
});

test("a single-customer rule beats a group rule, but only for that customer", () => {
	assert.equal(priceFromRules(bolt, rules, tree, { groupId: 6, customerId: 3110 }).ruleId, 701);
	assert.equal(priceFromRules(bolt, rules, tree, { groupId: 6, customerId: 999 }).ruleId, 754);
});

test("other groups' rules do not apply to the website groups", () => {
	const fastener = { ...bolt, treeIds: [268] }; // only under FASTENERS, where Gold has a rule
	assert.equal(priceFromRules(fastener, rules, tree, { groupId: 6 }).source, "list");
	assert.equal(priceFromRules(fastener, rules, tree, { groupId: 24 }).ruleId, 787);
});

test("no rule: list price; nothing usable: null", () => {
	assert.deepEqual(priceFromRules({ listPrice: 4.5, treeIds: [] }, rules, tree, { groupId: 6 }), {
		price: 4.5, ruleId: null, ruleName: "", source: "list",
	});
	assert.equal(priceFromRules({ listPrice: 0, treeIds: [] }, rules, tree, { groupId: 6 }), null);
});

test("a rule that would make a $0 price is skipped", () => {
	const free = { ...bolt, stdCost: 0, listPrice: 0.3 };
	assert.equal(priceFromRules(free, rules, tree, { groupId: 6 }).source, "list");
});

test("inactive, dated and quantity rules", () => {
	const inactive = rules.map((r) => (r.id === 754 ? { ...r, isActive: false } : r));
	assert.equal(priceFromRules(bolt, inactive, tree, { groupId: 6 }).ruleId, 304);
	const expired = rules.map((r) => (r.id === 754 ? { ...r, dateApplies: true, dateEnd: "2020-01-01" } : r));
	assert.equal(priceFromRules(bolt, expired, tree, { groupId: 6 }).ruleId, 304);
	const bulk = rules.map((r) => (r.id === 754 ? { ...r, qtyApplies: true, qtyMin: 100, qtyMax: 0 } : r));
	assert.equal(priceFromRules(bolt, bulk, tree, { groupId: 6, qty: 1 }).ruleId, 304);
	assert.equal(priceFromRules(bolt, bulk, tree, { groupId: 6, qty: 100 }).ruleId, 754);
});

test("price modes: markup by default, Fishbowl rule price when switched on", async () => {
	const { applyPriceMultiplier } = await import("../../../utils/resolveProductPrice.js");
	const rulePrices = {
		RETAIL: { price: 0.55, ruleName: "RETAIL CUSTOMER - Fasteners", source: "rule" },
		HOUSE: { price: 0.2895, ruleName: "HOUSE ACCOUNT FASTNERS", source: "rule" },
	};
	const info = { category: "bolts", makers: [], rulePrices };
	const retail = { approvedType: "RETAIL", multiplier: 5 };
	assert.equal(applyPriceMultiplier(0.1627, retail, info, []).resolvedPrice, 0.81); // markup mode
	assert.equal(applyPriceMultiplier(0.1627, retail, info, [], "fishbowl-rules").resolvedPrice, 0.55);
	assert.equal(applyPriceMultiplier(0.1627, { approvedType: "NET30", multiplier: 2.63 }, info, [], "fishbowl-rules").resolvedPrice, 0.29);
	// No rule price copied for this product: falls back to the markup.
	assert.equal(applyPriceMultiplier(0.1627, retail, { ...info, rulePrices: null }, [], "fishbowl-rules").resolvedPrice, 0.81);
});
