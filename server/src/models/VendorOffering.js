import mongoose from "mongoose";

const VendorOfferingInventorySchema = new mongoose.Schema(
  {
    qtyAvailable: { type: Number, default: 0 },
    qtyOnHand: { type: Number, default: 0 },
    qtyOnOrder: { type: Number, default: 0 },
    qtyAllocated: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const VendorOfferingPricingSchema = new mongoose.Schema(
  {
    cost: { type: Number, default: null },
    price: { type: Number, default: null },
    currency: { type: String, default: "USD" },
    priceSource: {
      type: String,
      enum: ["vendor-feed", "fishbowl", "manual", "rule"],
      default: "manual",
    },
    lastSyncedAt: { type: Date, default: null },
  },
  { _id: false }
);

const VendorOfferingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    vendorName: {
      type: String,
      required: true,
      index: true,
    },

    brandName: {
      type: String,
      default: "",
      index: true,
    },

    vendorPartNumber: {
      type: String,
      default: "",
      index: true,
    },

    vendorAltPartNumbers: [{ type: String }],

    fishbowlPartId: {
      type: String,
      default: "",
      index: true,
    },

    fishbowlPartNum: {
      type: String,
      default: "",
      index: true,
    },

    internalPartNumber: {
      type: String,
      default: "",
      index: true,
    },

    websiteSku: {
      type: String,
      default: "",
      index: true,
    },

    vendorDescription: {
      type: String,
      default: "",
    },

    vendorCategory: {
      type: String,
      default: "",
      index: true,
    },

    inventory: {
      type: VendorOfferingInventorySchema,
      default: () => ({}),
    },

    pricing: {
      type: VendorOfferingPricingSchema,
      default: () => ({}),
    },

    leadTimeDays: {
      type: Number,
      default: null,
    },

    minOrderQty: {
      type: Number,
      default: 1,
    },

    packQty: {
      type: Number,
      default: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isPreferred: {
      type: Boolean,
      default: false,
      index: true,
    },

    isSelectableByCustomer: {
      type: Boolean,
      default: false,
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["draft", "mapped", "approved", "archived"],
      default: "draft",
      index: true,
    },

    matchMethod: {
      type: String,
      enum: [
        "manual",
        "exact-part-number",
        "pattern-match",
        "description-match",
        "feed-import",
        "fishbowl-link",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },

    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    notes: {
      type: String,
      default: "",
    },

    feedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

VendorOfferingSchema.index(
  { productId: 1, vendorName: 1, vendorPartNumber: 1 },
  { unique: true, sparse: true }
);

VendorOfferingSchema.index({ productId: 1, isPreferred: 1 });
VendorOfferingSchema.index({ productId: 1, isActive: 1 });
VendorOfferingSchema.index({ vendorName: 1, approvalStatus: 1 });

export default mongoose.model("VendorOffering", VendorOfferingSchema);