import mongoose from "mongoose";

const GoogleReviewSchema = new mongoose.Schema(
  {
    reviewId: { type: String, default: "" },
    authorName: { type: String, default: "" },
    authorUrl: { type: String, default: "" },
    profilePhotoUrl: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    text: { type: String, default: "" },
    dateLabel: { type: String, default: "" },
    publishTime: { type: Date, default: null },
    languageCode: { type: String, default: "" },
  },
  { _id: false }
);

const GoogleReviewSnapshotSchema = new mongoose.Schema(
  {
    placeId: { type: String, required: true, unique: true, index: true },
    placeName: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    googleMapsUrl: { type: String, default: "" },
    writeReviewUrl: { type: String, default: "" },
    reviews: { type: [GoogleReviewSchema], default: [] },
    lastSyncedAt: { type: Date, default: null },
    syncStatus: {
      type: String,
      enum: ["never", "success", "failed"],
      default: "never",
      index: true,
    },
    syncError: { type: String, default: "" },
    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const GoogleReviewSnapshot =
  mongoose.models.GoogleReviewSnapshot ||
  mongoose.model("GoogleReviewSnapshot", GoogleReviewSnapshotSchema);

export default GoogleReviewSnapshot;
