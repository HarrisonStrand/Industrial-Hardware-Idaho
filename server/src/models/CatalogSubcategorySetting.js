import mongoose from "mongoose";

const DISPLAY_MODES = [
  "builder",
  "range-list",
  "product-grid",
  "coming-soon",
  "hidden",
];

const FALLBACK_MODES = [
  "range-list",
  "product-grid",
  "coming-soon",
  "hidden",
];

const RANGE_DATA_SOURCES = ["approved", "ready", "active-enriched"];
const PRIMARY_ACTIONS = ["shop", "quote", "contact", "parts-list", "none"];

const CatalogSubcategorySettingSchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subcategoryId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: "",
    },
    categoryName: {
      type: String,
      default: "",
    },
    displayMode: {
      type: String,
      enum: DISPLAY_MODES,
      default: "coming-soon",
      index: true,
    },
    fallbackMode: {
      type: String,
      enum: FALLBACK_MODES,
      default: "range-list",
    },
    rangeDataSource: {
      type: String,
      enum: RANGE_DATA_SOURCES,
      default: "ready",
    },
    isVisible: {
      type: Boolean,
      default: false,
      index: true,
    },
    showPricing: {
      type: Boolean,
      default: false,
    },
    allowCart: {
      type: Boolean,
      default: false,
    },
    image: {
      url: { type: String, default: "" },
      alt: { type: String, default: "" },
    },
    introText: {
      type: String,
      default: "",
    },
    contactMessage: {
      type: String,
      default: "",
    },
    primaryAction: {
      type: String,
      enum: PRIMARY_ACTIONS,
      default: "contact",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    adminNotes: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

CatalogSubcategorySettingSchema.index(
  { categoryId: 1, subcategoryId: 1 },
  { unique: true }
);

export {
  DISPLAY_MODES,
  FALLBACK_MODES,
  RANGE_DATA_SOURCES,
  PRIMARY_ACTIONS,
};

export default mongoose.model(
  "CatalogSubcategorySetting",
  CatalogSubcategorySettingSchema
);
