import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    source: {
      type: String,
      enum: ["vendor", "manual", "generated", "website", "unknown"],
      default: "unknown",
    },
    sourceVendor: { type: String, default: "" },
    sourcePartNumber: { type: String, default: "" },
    isPrimary: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: true },
    checksum: { type: String, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    backgroundRemoved: { type: Boolean, default: false },
    cleaned: { type: Boolean, default: false },
  },
  { _id: false }
);

const SeoSchema = new mongoose.Schema(
  {
    slug: { type: String, default: "", index: true },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    keywords: [{ type: String }],
    canonicalUrl: { type: String, default: "" },
  },
  { _id: false }
);

const QualityIssueSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    severity: {
      type: String,
      enum: ["info", "warning", "error"],
      default: "warning",
    },
    field: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const SimilarFamilyCandidateSchema = new mongoose.Schema(
  {
    familyKey: { type: String, default: "" },
    familyTitle: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
    reasons: [{ type: String }],
  },
  { _id: false }
);

const QualitySchema = new mongoose.Schema(
  {
    builderReady: { type: Boolean, default: false, index: true },
    renderable: { type: Boolean, default: false, index: true },
    publishReady: { type: Boolean, default: false, index: true },
    completenessScore: { type: Number, default: 0 },

    missingRequiredAttributes: [{ type: String }],
    missingRecommendedAttributes: [{ type: String }],
    issues: [QualityIssueSchema],

    suggestedFamilyKey: { type: String, default: "" },
    suggestedFamilyConfidence: { type: Number, default: 0 },
    similarFamilies: [SimilarFamilyCandidateSchema],

    lastEvaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ProductEnrichmentSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      index: true,
    },

    title: { type: String, default: "" },
    shortTitle: { type: String, default: "" },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    bulletPoints: [{ type: String }],

    websiteBrand: { type: String, default: "" },
    websiteVendor: { type: String, default: "" },

    category: { type: String, default: "", index: true },
    subcategory: { type: String, default: "", index: true },
    tags: [{ type: String }],
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },

    images: [ImageSchema],

    seo: { type: SeoSchema, default: () => ({}) },

    merchandising: {
      badge: { type: String, default: "" },
      featured: { type: Boolean, default: false, index: true },
      sortOrder: { type: Number, default: 0 },
      collectionTags: [{ type: String }],
    },

    contentStatus: {
      type: String,
      enum: ["empty", "auto-mapped", "partially-written", "ready-review", "approved"],
      default: "empty",
      index: true,
    },

    imageStatus: {
      type: String,
      enum: ["none", "matched", "partial", "needs-cleanup", "approved"],
      default: "none",
      index: true,
    },

    quality: { type: QualitySchema, default: () => ({}) },

    overrideFlags: {
      lockTitle: { type: Boolean, default: false },
      lockDescription: { type: Boolean, default: false },
      lockImages: { type: Boolean, default: false },
      lockCategory: { type: Boolean, default: false },
    },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

ProductEnrichmentSchema.index({ category: 1, subcategory: 1 });
ProductEnrichmentSchema.index({
  "merchandising.featured": 1,
  "merchandising.sortOrder": 1,
});
ProductEnrichmentSchema.index({ contentStatus: 1, imageStatus: 1 });
ProductEnrichmentSchema.index({ "seo.slug": 1 }, { unique: true, sparse: true });
ProductEnrichmentSchema.index({
  "quality.publishReady": 1,
  "quality.renderable": 1,
});
ProductEnrichmentSchema.index({ productId: 1, category: 1, subcategory: 1 });
ProductEnrichmentSchema.index({ productId: 1, "attributes.familyType": 1 });

export default mongoose.model("ProductEnrichment", ProductEnrichmentSchema);