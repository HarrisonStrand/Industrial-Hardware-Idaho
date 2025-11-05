import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "staff", "customer"], default: "customer" },
  company: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
