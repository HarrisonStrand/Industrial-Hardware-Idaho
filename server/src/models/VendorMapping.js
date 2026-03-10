import mongoose from "mongoose";

const VendorMappingSchema = new mongoose.Schema(
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

    matchMethod: {
      type: String,
      enum: [
        "manual",
        "exact-part-number",
        "pattern-match",
        "description-match",
        "feed-import",
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

    vendorCategory: { type: String, default: "" },
    vendorDescription: { type: String, default: "" },

    feedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    approved: { type: Boolean, default: false, index: true },
    needsReview: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

VendorMappingSchema.index({ vendorName: 1, vendorPartNumber: 1 });
VendorMappingSchema.index({ fishbowlPartNum: 1, vendorName: 1 });
VendorMappingSchema.index({ internalPartNumber: 1, vendorName: 1 });
VendorMappingSchema.index({ matchMethod: 1, confidenceScore: -1 });

export default mongoose.model("VendorMapping", VendorMappingSchema);