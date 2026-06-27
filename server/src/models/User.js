import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    address1: { type: String, trim: true, default: "" },
    address2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    zip: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const TaxSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["non_exempt", "pending", "exempt"],
      default: "non_exempt"
    },
    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    stripeCustomerId: { type: String, default: "" },
    defaultPaymentMethodId: { type: String, default: "" }
  },
  { _id: false }
);

const AccountSchema = new mongoose.Schema(
  {
    requestedType: {
      type: String,
      enum: ["RETAIL", "NET30", "HOUSE"],
      default: "RETAIL"
    },
    approvedType: {
      type: String,
      enum: ["RETAIL", "NET30", "HOUSE"],
      default: "RETAIL"
    },
    approvalStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE"
    },
    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    rejectionReason: { type: String, default: "" }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: { type: String, default: "", index: true },
    googlePicture: { type: String, default: "" },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    notes: { type: String, default: "" },

    role: { type: String, enum: ["user", "admin"], default: "user" },

    avatarUrl: { type: String, default: "" },
    avatarKey: { type: String, default: "" },
    avatarUpdatedAt: { type: Date, default: null },

    company: { name: { type: String, default: "" } },

    billingAddress: { type: AddressSchema, default: () => ({}) },
    deliveryAddress: { type: AddressSchema, default: () => ({}) },

    tax: { type: TaxSchema, default: () => ({}) },

    account: { type: AccountSchema, default: () => ({}) },

    payment: { type: PaymentSchema, default: () => ({}) },

    // used by your forgot/reset flow
    resetPasswordTokenHash: { type: String, default: "" },
    resetPasswordExpiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

UserSchema.index({ googleId: 1 });

export default mongoose.model("User", UserSchema);
