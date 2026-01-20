import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema(
  {
    companyName: { type: String, trim: true },
    phone: { type: String, trim: true },
    address1: { type: String, trim: true },
    address2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    taxExempt: { type: Boolean, default: false },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    role: { type: String, enum: ["user", "admin"], default: "user" },

    avatarUrl: { type: String, default: "" },
    avatarKey: { type: String, default: "" },
    avatarUpdatedAt: { type: Date, default: null },

    // ✅ Password reset
    resetPasswordTokenHash: { type: String, default: "" },
    resetPasswordExpiresAt: { type: Date, default: null },

    company: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      taxStatus: { type: String, default: "" },
      notes: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
