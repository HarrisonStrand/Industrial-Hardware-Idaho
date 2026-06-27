import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    companyName: { type: String, default: "", trim: true },
    address1: { type: String, default: "" },
    address2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zip: { type: String, default: "" },
  },
  { _id: false },
);

const OrderItemSchema = new mongoose.Schema(
  {
    partNumber: { type: String, required: true, trim: true },
    name: { type: String, default: "", trim: true },
    detail: { type: String, default: "", trim: true },
    qty: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    vendorOfferingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorOffering",
      default: null,
    },
    vendorName: { type: String, default: "", trim: true },
    vendorPartNumber: { type: String, default: "", trim: true },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customer: {
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      companyName: { type: String, default: "" },
    },

    billingAddress: { type: AddressSchema, default: () => ({}) },
    shippingAddress: { type: AddressSchema, default: () => ({}) },
    shippingSameAsBilling: { type: Boolean, default: true },

    poNumber: { type: String, default: "", trim: true },
    customerPO: { type: String, default: "", trim: true },
    purchaseOrderNumber: { type: String, default: "", trim: true },

    items: { type: [OrderItemSchema], default: [] },

    currency: { type: String, default: "usd" },
    amountTotalCents: { type: Number, default: 0 },

    payment: {
      mode: {
        type: String,
        enum: ["PAY_NOW", "PAY_LATER"],
        default: "PAY_NOW",
      },
      status: {
        type: String,
        enum: ["PENDING", "SUCCEEDED", "FAILED", "INVOICED"],
        default: "PENDING",
      },
      stripePaymentIntentId: { type: String, default: "" },
    },

    fishbowlId: { type: String, default: "" },
    fishbowlNumber: { type: String, default: "" },
    fishbowlStatus: { type: String, default: "" },
    fishbowlError: { type: String, default: "" },
    fishbowlPushedAt: { type: Date, default: null },

    confirmationEmail: {
      sentAt: { type: Date, default: null },
      lastError: { type: String, default: "" },
    },

    adminNotificationEmail: {
      sentAt: { type: Date, default: null },
      lastError: { type: String, default: "" },
    },

    adminReview: {
      status: {
        type: String,
        enum: ["PENDING", "APPROVED_IN_PROGRESS", "APPROVED_COMPLETED", "DENIED"],
        default: "PENDING",
      },
      deniedReason: { type: String, default: "" },
      reviewedAt: { type: Date, default: null },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Order", OrderSchema);
