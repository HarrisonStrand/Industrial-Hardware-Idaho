import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    partNumber: { type: String, required: true },
    name: { type: String, default: "" },
    detail: { type: String, default: "" },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    address1: String,
    address2: String,
    city: String,
    state: String,
    zip: String
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: { type: [OrderItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    billingAddress: { type: AddressSchema, default: () => ({}) },
    deliveryAddress: { type: AddressSchema, default: () => ({}) },

    paymentMode: { type: String, enum: ["PAY_NOW", "PAY_LATER"], required: true },
    payLaterType: { type: String, enum: ["NET30", "HOUSE", ""], default: "" },

    paymentStatus: { type: String, enum: ["UNPAID", "PAID"], default: "UNPAID" },
    status: { type: String, enum: ["PENDING", "PROCESSING", "FULFILLED", "CANCELED"], default: "PENDING" },

    stripePaymentIntentId: { type: String, default: "" },

    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);
