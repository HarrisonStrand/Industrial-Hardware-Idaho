import mongoose from "mongoose";

const FamilyImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    source: {
      type: String,
      enum: ["manual", "generated", "website", "unknown"],
      default: "unknown",
    },
    isPrimary: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false }
);

const CatalogFamilyAssetSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, index: true },
    subcategory: { type: String, required: true, index: true },
    familyKey: { type: String, required: true, index: true },
    familySlug: { type: String, default: "" },
    familyTitle: { type: String, default: "" },
    familyDescription: { type: String, default: "" },
    image: { type: FamilyImageSchema, default: null },
    status: {
      type: String,
      enum: ["none", "ready", "approved"],
      default: "none",
      index: true,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

CatalogFamilyAssetSchema.index(
  { category: 1, subcategory: 1, familyKey: 1 },
  { unique: true }
);

export default mongoose.model("CatalogFamilyAsset", CatalogFamilyAssetSchema);