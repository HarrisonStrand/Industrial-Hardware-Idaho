// Read-only report: for every published product, the website price today (markup mode) next to the price
// Fishbowl's own pricing rules give, for Retail and for House / Net 30. Used to review before switching
// Admin > Pricing to "Fishbowl rules". Changes nothing.

import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import { FishbowlPricingSnapshot, FishbowlProductPrice } from "../../models/FishbowlPricing.js";
import { priceGroupInfo } from "../../config/fixedPriceGroups.js";
import { applyPriceMultiplier, getPricingContext, getPricingSettings } from "../../utils/resolveProductPrice.js";
import { productPartNumber } from "./loadRulePrices.js";

function round2(value) {
	return value === null || value === undefined ? null : Math.round(Number(value) * 100) / 100;
}

function changePct(before, after) {
	if (!before || after === null || after === undefined) return null;
	return Math.round(((after - before) / before) * 1000) / 10;
}

function bucket(pct) {
	if (pct === null) return "no rule price";
	if (Math.abs(pct) < 1) return "same (within 1%)";
	if (pct <= -50) return "more than 50% lower";
	if (pct < 0) return "lower";
	if (pct >= 50) return "more than 50% higher";
	return "higher";
}

export async function comparePricingModes() {
	const settings = await getPricingSettings({ forceRefresh: true });
	const retail = await getPricingContext({ approvedType: "RETAIL" }, settings);
	const house = await getPricingContext({ approvedType: "HOUSE", approvalStatus: "APPROVED" }, settings);

	const products = await Product.find(
		{ isPublished: true },
		{ sku: 1, brand: 1, vendor: 1, "fishbowl.partNum": 1, "fishbowl.description": 1, "pricing.basePrice": 1, "pricing.salePrice": 1 },
	).lean();
	const enrichments = await ProductEnrichment.find(
		{ productId: { $in: products.map((p) => p._id) } },
		{ productId: 1, category: 1, subcategory: 1, title: 1, "manufacturer.name": 1 },
	).lean();
	const enrichmentById = new Map(enrichments.map((row) => [String(row.productId), row]));
	const ruleRows = await FishbowlProductPrice.find({}, { partNumber: 1, prices: 1, stdCost: 1, listPrice: 1 }).lean();
	const ruleByPart = new Map(ruleRows.map((row) => [row.partNumber, row]));
	const snapshot = await FishbowlPricingSnapshot.findOne({ key: "default" }, { counts: 1, syncedAt: 1 }).lean();

	const rows = [];
	const summary = { RETAIL: {}, HOUSE: {} };
	for (const product of products) {
		const enrichment = enrichmentById.get(String(product._id)) || {};
		const part = productPartNumber(product);
		const rule = ruleByPart.get(part) || null;
		const base = product?.pricing?.basePrice ?? product?.pricing?.salePrice ?? 0;
		const info = priceGroupInfo(product, enrichment);
		const today = {
			RETAIL: applyPriceMultiplier(base, retail, info, settings.fixedPriceGroups).resolvedPrice,
			HOUSE: applyPriceMultiplier(base, house, info, settings.fixedPriceGroups).resolvedPrice,
		};
		const row = {
			partNumber: part,
			title: enrichment.title || product?.fishbowl?.description || "",
			category: enrichment.category || "",
			subcategory: enrichment.subcategory || "",
			listPrice: rule?.listPrice ?? null,
			stdCost: rule?.stdCost ?? null,
		};
		for (const group of ["RETAIL", "HOUSE"]) {
			const rulePrice = rule?.prices?.[group] || null;
			const next = rulePrice?.price ? round2(rulePrice.price) : null;
			const pct = changePct(today[group], next);
			row[`${group}_today`] = today[group];
			row[`${group}_fishbowl`] = next;
			row[`${group}_changePct`] = pct;
			row[`${group}_rule`] = rulePrice ? (rulePrice.source === "rule" ? rulePrice.ruleName : "list price") : "";
			const key = bucket(pct);
			summary[group][key] = (summary[group][key] || 0) + 1;
		}
		rows.push(row);
	}

	rows.sort((a, b) => Math.abs(b.RETAIL_changePct ?? 0) - Math.abs(a.RETAIL_changePct ?? 0));
	return {
		priceMode: settings.priceMode,
		rulesCopiedAt: snapshot?.syncedAt || null,
		rulesCounts: snapshot?.counts || {},
		products: rows.length,
		summary,
		rows,
	};
}

const CSV_COLUMNS = [
	"partNumber", "title", "category", "subcategory", "listPrice", "stdCost",
	"RETAIL_today", "RETAIL_fishbowl", "RETAIL_changePct", "RETAIL_rule",
	"HOUSE_today", "HOUSE_fishbowl", "HOUSE_changePct", "HOUSE_rule",
];

export function comparisonCsv(rows = []) {
	const cell = (value) => {
		const text = value === null || value === undefined ? "" : String(value);
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	};
	return [CSV_COLUMNS.join(","), ...rows.map((row) => CSV_COLUMNS.map((key) => cell(row[key])).join(","))].join("\n");
}
