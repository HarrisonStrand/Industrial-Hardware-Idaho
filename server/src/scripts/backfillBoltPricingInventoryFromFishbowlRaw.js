import "../config/env.js";
import mongoose from "mongoose";

import Product from "../models/Product.js";
import ProductEnrichment from "../models/ProductEnrichment.js";

const dryRun = process.argv.includes("--dry-run");
const samples = process.argv.includes("--samples");

function getByPath(source = {}, path = "") {
	return String(path || "")
		.split(".")
		.filter(Boolean)
		.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
}

function firstFiniteNumber(...values) {
	for (const value of values) {
		if (value === undefined || value === null || value === "") continue;
		const num = Number(value);
		if (Number.isFinite(num)) return num;
	}
	return null;
}

function resolveRawQty(raw = {}, key = "qtyAvailable") {
	const paths = {
		qtyAvailable: [
			"qtyAvailable",
			"quantityAvailable",
			"availableQty",
			"available",
			"availableToSell",
			"inventory.qtyAvailable",
			"inventory.quantityAvailable",
			"inventory.available",
			"raw.qtyAvailable",
			"raw.quantityAvailable",
		],
		qtyOnHand: [
			"qtyOnHand",
			"quantityOnHand",
			"onHand",
			"inventory.qtyOnHand",
			"inventory.quantityOnHand",
			"inventory.onHand",
			"raw.qtyOnHand",
		],
		qtyAllocated: ["qtyAllocated", "allocated", "inventory.qtyAllocated", "inventory.allocated"],
		qtyOnOrder: ["qtyOnOrder", "onOrder", "inventory.qtyOnOrder", "inventory.onOrder"],
	};

	return firstFiniteNumber(...(paths[key] || []).map((path) => getByPath(raw, path)));
}

function resolveRawPrice(raw = {}) {
	return firstFiniteNumber(
		getByPath(raw, "pricing.salePrice"),
		getByPath(raw, "pricing.basePrice"),
		getByPath(raw, "salePrice"),
		getByPath(raw, "basePrice"),
		getByPath(raw, "unitPrice"),
		getByPath(raw, "price"),
		getByPath(raw, "raw.price"),
		getByPath(raw, "raw.unitPrice"),
	);
}

function hasRealNumber(value) {
	return Number.isFinite(Number(value)) && Number(value) > 0;
}

async function main() {
	await mongoose.connect(process.env.MONGO_URI);
	console.log("✅ MongoDB connected");

	const enrichments = await ProductEnrichment.find(
		{ category: /^bolts$/i },
		{ productId: 1 },
	).lean();

	const productIds = enrichments.map((item) => item.productId).filter(Boolean);
	const products = await Product.find({ _id: { $in: productIds } });

	const summary = {
		boltProducts: products.length,
		updatedInventory: 0,
		updatedPricing: 0,
		missingRawInventory: 0,
		missingRawPrice: 0,
		unchanged: 0,
	};

	const sampleRows = [];

	for (const product of products) {
		const raw = product?.fishbowl?.raw || {};
		const nextQtyAvailable = resolveRawQty(raw, "qtyAvailable");
		const nextQtyOnHand = resolveRawQty(raw, "qtyOnHand");
		const nextQtyAllocated = resolveRawQty(raw, "qtyAllocated");
		const nextQtyOnOrder = resolveRawQty(raw, "qtyOnOrder");
		const nextBasePrice = resolveRawPrice(raw);

		let changed = false;
		let inventoryChanged = false;
		let pricingChanged = false;

		if (!hasRealNumber(product?.inventory?.qtyAvailable) && nextQtyAvailable !== null) {
			product.inventory.qtyAvailable = nextQtyAvailable;
			changed = true;
			inventoryChanged = true;
		}
		if (!hasRealNumber(product?.inventory?.qtyOnHand) && nextQtyOnHand !== null) {
			product.inventory.qtyOnHand = nextQtyOnHand;
			changed = true;
			inventoryChanged = true;
		}
		if (!hasRealNumber(product?.inventory?.qtyAllocated) && nextQtyAllocated !== null) {
			product.inventory.qtyAllocated = nextQtyAllocated;
			changed = true;
			inventoryChanged = true;
		}
		if (!hasRealNumber(product?.inventory?.qtyOnOrder) && nextQtyOnOrder !== null) {
			product.inventory.qtyOnOrder = nextQtyOnOrder;
			changed = true;
			inventoryChanged = true;
		}

		if (!hasRealNumber(product?.pricing?.basePrice) && nextBasePrice !== null) {
			product.pricing.basePrice = nextBasePrice;
			product.pricing.priceSource = "fishbowl";
			changed = true;
			pricingChanged = true;
		}

		if (inventoryChanged) summary.updatedInventory += 1;
		if (pricingChanged) summary.updatedPricing += 1;
		if (!inventoryChanged && nextQtyAvailable === null && !hasRealNumber(product?.inventory?.qtyAvailable)) {
			summary.missingRawInventory += 1;
		}
		if (!pricingChanged && nextBasePrice === null && !hasRealNumber(product?.pricing?.basePrice)) {
			summary.missingRawPrice += 1;
		}
		if (!changed) summary.unchanged += 1;

		if (samples && sampleRows.length < 25 && (changed || !hasRealNumber(product?.pricing?.basePrice) || !hasRealNumber(product?.inventory?.qtyAvailable))) {
			sampleRows.push({
				partNumber: product?.fishbowl?.partNum || product?.sku || "",
				description: product?.fishbowl?.description || "",
				inventoryBefore: product?.inventory || {},
				rawQtyAvailable: nextQtyAvailable,
				rawBasePrice: nextBasePrice,
				wouldChange: changed,
			});
		}

		if (changed && !dryRun) {
			await product.save();
		}
	}

	console.log(dryRun ? "🔎 Dry run only" : "✍️ Applied bolt pricing/inventory fallback backfill");
	console.log("===== BOLT PRICING / INVENTORY SUMMARY =====");
	console.log(summary);

	if (samples) {
		console.log("===== SAMPLES =====");
		console.log(JSON.stringify(sampleRows, null, 2));
	}

	await mongoose.disconnect();
	console.log("✅ Done");
}

main().catch(async (err) => {
	console.error("❌ Bolt pricing/inventory backfill failed:", err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
