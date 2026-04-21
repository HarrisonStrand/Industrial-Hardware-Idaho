import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    authorName: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },

    source: {
      type: String,
      enum: ["website", "google"],
      default: "website",
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    isFeatured: { type: Boolean, default: false, index: true },
    submittedAt: { type: Date, default: Date.now, index: true },

    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.Mixed, default: null },

    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.Mixed, default: null },

    externalId: { type: String, default: "", index: true },
    externalUrl: { type: String, default: "" },
    dateLabel: { type: String, default: "" },
  },
  { timestamps: true }
);

ReviewSchema.index({ status: 1, submittedAt: -1 });
ReviewSchema.index({ source: 1, status: 1 });

const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);

export default Review;