import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. "orderNumber-2026"
    seq: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("Counter", CounterSchema);