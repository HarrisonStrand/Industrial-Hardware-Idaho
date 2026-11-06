// Fishbowl pricing rules, worked out in plain code (no database, no network).
// The rule fields were decoded from Fishbowl's data and checked against 4,000 real sales lines.
//
// A rule says WHO (all customers, one customer, or a customer group), WHAT (all products, one product, or a
// product category and everything under it) and HOW (fixed price, markup or margin on list price or cost).
// The most specific matching rule wins (one customer > group > all; one product > category > all), tier-1
// rules before tier-2 rules, the lower price on a tie. No rule: the list price.

// Fishbowl customer groups the website uses (decided 2026-11-06): guests and Retail follow RETAIL CUSTOMER,
// House and Net 30 follow HOUSE ACCOUNT.
export const FISHBOWL_GROUPS = { RETAIL: 6, HOUSE: 7 };

export function websiteGroupFor(approvedType = "RETAIL") {
	const type = String(approvedType || "RETAIL").toUpperCase();
	return type === "HOUSE" || type === "NET30" ? "HOUSE" : "RETAIL";
}

const CUSTOMER = { ALL: 1, ONE: 2, GROUP: 3 };
const PRODUCT = { ALL: 1, ONE: 2, CATEGORY: 3 };
const BASE = { AVERAGE_COST: 1, LIST: 5, STANDARD_COST: 6 };
const KIND = { PERCENT: 1, MARKUP: 2, MARGIN: 3, BASE_PLUS: 5, FIXED: 6 };

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function roundPrice(value) {
	return Math.round(value * 10000) / 10000;
}

// Every category id a product sits in, plus every category above those.
export function categoriesWithParents(treeIds = [], treeById = new Map()) {
	const out = new Set();
	for (const start of treeIds) {
		let id = Number(start);
		let guard = 0;
		while (id && !out.has(id) && guard < 50) {
			out.add(id);
			id = Number(treeById.get(id)?.parentId || 0);
			guard += 1;
		}
	}
	return out;
}

function baseAmount(rule, product) {
	switch (Number(rule.paBaseAmountTypeId)) {
		case BASE.LIST:
			return num(product.listPrice);
		case BASE.STANDARD_COST:
			return num(product.stdCost);
		case BASE.AVERAGE_COST:
			return num(product.avgCost);
		default:
			return null; // not decoded (one VEGA rule): the rule is skipped
	}
}

// The price one rule gives a product, or null when the rule cannot price it.
export function rulePrice(rule, product) {
	const kind = Number(rule.paTypeId);
	const pct = num(rule.paPercent) || 0;
	const amount = num(rule.paAmount) || 0;
	let price = null;

	if (kind === KIND.FIXED) {
		price = amount;
	} else {
		const base = baseAmount(rule, product);
		if (base === null) return null;
		if (kind === KIND.MARKUP || kind === KIND.PERCENT) price = base * (1 + pct);
		else if (kind === KIND.MARGIN) price = pct < 1 ? base / (1 - pct) : null;
		else if (kind === KIND.BASE_PLUS) price = base + amount;
	}

	// A rule that comes out at $0 or less (e.g. a margin on a cost of $0) never sets a price.
	if (price === null || !Number.isFinite(price) || price <= 0) return null;
	return roundPrice(price);
}

function ruleApplies(rule, product, { groupId, customerId = null, qty = 1, date = new Date() }, categories) {
	if (rule.isActive === false || rule.isAutoApply === false) return false;

	const productType = Number(rule.productInclTypeId);
	if (productType === PRODUCT.ONE && Number(rule.productInclId) !== Number(product.fishbowlProductId)) return false;
	if (productType === PRODUCT.CATEGORY && !categories.has(Number(rule.productInclId))) return false;
	if (![PRODUCT.ALL, PRODUCT.ONE, PRODUCT.CATEGORY].includes(productType)) return false;

	const customerType = Number(rule.customerInclTypeId);
	if (customerType === CUSTOMER.ONE && (customerId === null || Number(rule.customerInclId) !== Number(customerId))) return false;
	if (customerType === CUSTOMER.GROUP && Number(rule.customerInclId) !== Number(groupId)) return false;
	if (![CUSTOMER.ALL, CUSTOMER.ONE, CUSTOMER.GROUP].includes(customerType)) return false;

	if (rule.qtyApplies) {
		const min = num(rule.qtyMin) || 0;
		const max = num(rule.qtyMax) || 0;
		if (qty < min || (max > 0 && qty > max)) return false;
	}
	if (rule.dateApplies) {
		const begin = rule.dateBegin ? new Date(rule.dateBegin) : null;
		const end = rule.dateEnd ? new Date(rule.dateEnd) : null;
		if ((begin && date < begin) || (end && date > end)) return false;
	}
	return true;
}

function specificity(rule) {
	const customer = { [CUSTOMER.ONE]: 3, [CUSTOMER.GROUP]: 2, [CUSTOMER.ALL]: 1 }[Number(rule.customerInclTypeId)] || 0;
	const product = { [PRODUCT.ONE]: 3, [PRODUCT.CATEGORY]: 2, [PRODUCT.ALL]: 1 }[Number(rule.productInclTypeId)] || 0;
	return customer * 10 + product;
}

// product: { fishbowlProductId, listPrice, stdCost, avgCost, treeIds }
// Returns { price, ruleId, ruleName, source: "rule" | "list" } or null when there is no usable price.
export function priceFromRules(product, rules = [], treeById = new Map(), options = {}) {
	const categories = categoriesWithParents(product.treeIds || [], treeById);
	const candidates = [];
	for (const rule of rules) {
		if (!ruleApplies(rule, product, options, categories)) continue;
		const price = rulePrice(rule, product);
		if (price === null) continue;
		candidates.push({ rule, price });
	}

	const tier1 = candidates.filter((c) => !c.rule.isTier2);
	const pool = tier1.length ? tier1 : candidates;
	if (pool.length) {
		pool.sort((a, b) => specificity(b.rule) - specificity(a.rule) || a.price - b.price);
		const best = pool[0];
		return { price: best.price, ruleId: best.rule.id, ruleName: best.rule.name || "", source: "rule" };
	}

	const list = num(product.listPrice);
	if (list !== null && list > 0) return { price: roundPrice(list), ruleId: null, ruleName: "", source: "list" };
	return null;
}

// The website's two prices for a product: RETAIL (guests, Retail) and HOUSE (House, Net 30).
export function websiteRulePrices(product, rules, treeById, options = {}) {
	return {
		RETAIL: priceFromRules(product, rules, treeById, { ...options, groupId: FISHBOWL_GROUPS.RETAIL }),
		HOUSE: priceFromRules(product, rules, treeById, { ...options, groupId: FISHBOWL_GROUPS.HOUSE }),
	};
}
