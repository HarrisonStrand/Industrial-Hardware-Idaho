import mongoose from "mongoose";

// One row per Fishbowl price change the price sync found: the log of every automatic change, and the
// list of changes waiting for an admin (status "pending").
const PriceChangeSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    partNumber: { type: String, default: "", index: true },
    description: { type: String, default: "" },
    oldPrice: { type: Number, default: null },
    newPrice: { type: Number, required: true },
    changePct: { type: Number, default: null },
    // applied = went live on its own; pending = waits for an admin; approved / rejected = admin decided;
    // cleared = Fishbowl went back to the site's price before anyone decided.
    status: {
      type: String,
      enum: ["applied", "pending", "approved", "rejected", "cleared"],
      required: true,
      index: true,
    },
    reason: { type: String, default: "" },
    detectedAt: { type: Date, default: Date.now, index: true },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: String, default: "" },
    syncRunId: { type: mongoose.Schema.Types.ObjectId, ref: "SyncRun", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PriceChange", PriceChangeSchema);
