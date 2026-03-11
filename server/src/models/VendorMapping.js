import mongoose from "mongoose";

const VendorMappingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    vendorOfferingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorOffering",
      default: null,
      index: true,
    },

    vendorName: {
      type: String,
      required: true,
      index: true,
    },

    manufacturerName: {
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

    vendorPartNumber: {
      type: String,
      default: "",
      index: true,
    },

    vendorAltPartNumbers: [{ type: String }],

    vendorCategory: {
      type: String,
      default: "",
      index: true,
    },

    vendorDescription: {
      type: String,
      default: "",
    },

    matchMethod: {
      type: String,
      enum: [
        "manual",
        "exact-part-number",
        "pattern-match",
        "description-match",
        "feed-import",
        "vendor-offering-link",
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

    approved: {
      type: Boolean,
      default: false,
      index: true,
    },

    needsReview: {
      type: Boolean,
      default: true,
      index: true,
    },

    isPrimaryMapping: {
      type: Boolean,
      default: false,
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

VendorMappingSchema.index(
  { productId: 1, vendorName: 1, vendorPartNumber: 1 },
  { unique: true, sparse: true }
);

VendorMappingSchema.index({ vendorOfferingId: 1 });
VendorMappingSchema.index({ fishbowlPartNum: 1, vendorName: 1 });
VendorMappingSchema.index({ internalPartNumber: 1, vendorName: 1 });
VendorMappingSchema.index({ vendorName: 1, approved: 1, needsReview: 1 });
VendorMappingSchema.index({ matchMethod: 1, confidenceScore: -1 });

export default mongoose.model("VendorMapping", VendorMappingSchema);