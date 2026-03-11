import mongoose from "mongoose";

const SyncRunSchema = new mongoose.Schema(
  {
    jobType: {
      type: String,
      enum: [
        "fishbowl-products",
        "fishbowl-inventory",
        "fishbowl-customers",
        "vendor-brighton-import",
        "product-enrichment-pass",
      ],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["running", "success", "partial", "failed"],
      default: "running",
      index: true,
    },

    startedAt: { type: Date, default: Date.now, index: true },
    finishedAt: { type: Date, default: null },

    stats: {
      found: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    errors: [
      {
        key: { type: String, default: "" },
        message: { type: String, default: "" },
        payload: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    notes: { type: String, default: "" },
  },
  { timestamps: true },
	{ suppressReservedKeysWarning: true }
);

export default mongoose.model("SyncRun", SyncRunSchema);