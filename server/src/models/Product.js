import mongoose from "mongoose";

const InventorySnapshotSchema = new mongoose.Schema(
  {
    qtyOnHand: { type: Number, default: 0 },
    qtyAvailable: { type: Number, default: 0 },
    qtyAllocated: { type: Number, default: 0 },
    qtyOnOrder: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PricingSnapshotSchema = new mongoose.Schema(
  {
    cost: { type: Number, default: null },
    basePrice: { type: Number, default: null },
    salePrice: { type: Number, default: null },
    currency: { type: String, default: "USD" },
    priceSource: {
      type: String,
      enum: ["fishbowl", "website", "manual", "rule"],
      default: "fishbowl",
    },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const FishbowlLinkSchema = new mongoose.Schema(
  {
    partId: { type: String, index: true },
    partNum: { type: String, index: true },
    uom: { type: String, default: "" },
    status: { type: String, default: "" },
    type: { type: String, default: "" },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    internalPartNumber: { type: String, default: "", index: true },

    fishbowl: { type: FishbowlLinkSchema, required: true },

    vendor: {
      type: String,
      default: "",
      index: true,
    },
    brand: {
      type: String,
      default: "",
      index: true,
    },

    inventory: { type: InventorySnapshotSchema, default: () => ({}) },
    pricing: { type: PricingSnapshotSchema, default: () => ({}) },

    isActive: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false, index: true },
    isCurated: { type: Boolean, default: false, index: true },

    catalogStatus: {
      type: String,
      enum: ["draft", "mapped", "enriched", "ready", "published", "archived"],
      default: "draft",
      index: true,
    },

    hasEnrichment: { type: Boolean, default: false, index: true },
    hasImages: { type: Boolean, default: false, index: true },
    needsReview: { type: Boolean, default: true, index: true },

    categoryHints: [{ type: String }],
    searchKeywords: [{ type: String }],

    enrichmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductEnrichment",
      default: null,
    },

    sourceHashes: {
      fishbowlHash: { type: String, default: "" },
      inventoryHash: { type: String, default: "" },
      pricingHash: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

ProductSchema.index({ vendor: 1, isPublished: 1 });
ProductSchema.index({ brand: 1, isPublished: 1 });
ProductSchema.index({ catalogStatus: 1, isCurated: 1 });
ProductSchema.index({ "fishbowl.partNum": 1 });
ProductSchema.index({ internalPartNumber: 1 });

export default mongoose.model("Product", ProductSchema);