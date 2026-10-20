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

    // Catalog enrichment. `representative: true` means the
    // picture is not a photo of this exact product: show "Representative image".
    s3Key: { type: String, default: "" },
    origin: {
      type: String,
      enum: ["", "manufacturer", "existing_site", "rendered_3d", "ai_generated"],
      default: "",
    },
    representative: { type: Boolean, default: false },
    sourceUrl: { type: String, default: "" },
    sha256: { type: String, default: "" },
    retrievedAt: { type: Date, default: null },
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

const ManufacturerSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    brand: { type: String, default: "" },
    mfrPartNumber: { type: String, default: "" }, // the MCN
    mcnStatus: {
      type: String,
      enum: ["verified", "candidate", "unmatched", "not_applicable"],
    },
    matchConfidence: { type: String, enum: ["high", "medium", "low"] },
    productUrl: { type: String, default: "" },
    upc: { type: String, default: "" },
    // "USA" only when the IHI description says DOM / DOMESTIC / DMESTIC.
    countryOfOrigin: { type: String, default: "" },
    lastVerifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const SpecSchema = new mongoose.Schema(
  {
    // Mechanical | Dimensions | Ratings | Standards | Electrical | Chemical | Other
    group: { type: String, default: "" },
    name: { type: String, default: "" },
    value: { type: String, default: "" },
    unit: { type: String, default: "" },
    basis: { type: String, enum: ["manufacturer", "derived_from_standard"] },
    reference: { type: String, default: "" }, // e.g. 'SAE J429 Grade 5 (1/4"–1")'
    sourceUrl: { type: String, default: "" },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["spec_sheet", "sds", "catalog_page", "instructions", "warranty"],
    },
    title: { type: String, default: "" },
    s3Key: { type: String, default: "" },
    url: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
    sha256: { type: String, default: "" },
    retrievedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ProvenanceSchema = new mongoose.Schema(
  {
    field: { type: String, default: "" },
    source: { type: String, default: "" },
    confidence: { type: String, default: "" },
    url: { type: String, default: "" },
    agent: { type: String, default: "" },
    note: { type: String, default: "" },
    at: { type: Date, default: null },
  },
  { _id: false }
);

// STAGING for catalog enrichment. Enrichment writes only here until
// a batch is approved; promotion then copies to the live fields.
const AgentDraftSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["draft", "ready-review", "approved", "rejected", "promoted"],
      default: "draft",
    },
    batchId: { type: String },
    pipelineVersion: { type: String },
    audit: { type: mongoose.Schema.Types.Mixed },
    manufacturer: { type: mongoose.Schema.Types.Mixed },
    title: { type: String },
    shortTitle: { type: String },
    description: { type: String },
    shortDescription: { type: String },
    bulletPoints: { type: [String], default: undefined },
    uses: { type: [String], default: undefined },
    tags: { type: [String], default: undefined },
    category: { type: String },
    subcategory: { type: String },
    familyKey: { type: String },
    attributes: { type: mongoose.Schema.Types.Mixed },
    packaging: { type: mongoose.Schema.Types.Mixed },
    specs: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    images: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    documents: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    seo: { type: mongoose.Schema.Types.Mixed },
    // An array because Mongo keys cannot contain dots ("attributes.grade").
    provenance: { type: [ProvenanceSchema], default: undefined },
    agentRuns: { type: mongoose.Schema.Types.Mixed },
    issues: { type: [String], default: undefined },
    questions: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    qa: { type: mongoose.Schema.Types.Mixed },
    humanLocked: { type: [String], default: undefined }, // field paths edited by hand
    generatedAt: { type: Date },
    promotedAt: { type: Date },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
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
      lockAttributes: { type: Boolean, default: false },
      lockSpecs: { type: Boolean, default: false },
      lockSeo: { type: Boolean, default: false },
    },

    notes: { type: String, default: "" },

    // Catalog enrichment: live fields, filled on promotion.
    manufacturer: { type: ManufacturerSchema, default: undefined },
    specs: { type: [SpecSchema], default: undefined },
    documents: { type: [DocumentSchema], default: undefined },
    uses: { type: [String], default: undefined },
    packaging: {
      quantity: { type: Number },
      unit: { type: String },
    },

    // Catalog enrichment: staging. Absent until a product is first staged.
    agentDraft: { type: AgentDraftSchema, default: undefined },
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
ProductEnrichmentSchema.index({ "agentDraft.batchId": 1 });
ProductEnrichmentSchema.index({ "agentDraft.status": 1 });
ProductEnrichmentSchema.index({ "manufacturer.mfrPartNumber": 1 });

export default mongoose.model("ProductEnrichment", ProductEnrichmentSchema);