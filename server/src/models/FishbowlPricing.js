import mongoose from "mongoose";

// A read-only copy of Fishbowl's pricing data, refreshed by the Fishbowl pricing-rules copy
// (services/fishbowl/syncFishbowlPricingRules.js). Nothing here is ever sent back to Fishbowl.

// The rules and the product category tree, as one record.
const FishbowlPricingSnapshotSchema = new mongoose.Schema(
	{
		key: { type: String, default: "default", unique: true },
		rules: { type: [mongoose.Schema.Types.Mixed], default: [] },
		tree: { type: [mongoose.Schema.Types.Mixed], default: [] },
		counts: { type: mongoose.Schema.Types.Mixed, default: {} },
		syncedAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

const RulePriceSchema = new mongoose.Schema(
	{
		price: { type: Number, default: null },
		ruleId: { type: Number, default: null },
		ruleName: { type: String, default: "" },
		source: { type: String, default: "" }, // "rule" or "list"
	},
	{ _id: false }
);

// One row per Fishbowl part number: list price, costs, categories, and the website's two rule prices.
const FishbowlProductPriceSchema = new mongoose.Schema(
	{
		partNumber: { type: String, required: true, unique: true },
		fishbowlProductId: { type: Number, default: null },
		listPrice: { type: Number, default: null },
		stdCost: { type: Number, default: null },
		avgCost: { type: Number, default: null },
		treeIds: { type: [Number], default: [] },
		prices: {
			RETAIL: { type: RulePriceSchema, default: null },
			HOUSE: { type: RulePriceSchema, default: null },
		},
		syncedAt: { type: Date, default: null, index: true },
	},
	{ timestamps: true }
);

export const FishbowlPricingSnapshot = mongoose.model("FishbowlPricingSnapshot", FishbowlPricingSnapshotSchema);
export const FishbowlProductPrice = mongoose.model("FishbowlProductPrice", FishbowlProductPriceSchema);
