import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
	{
		address1: String,
		address2: String,
		city: String,
		state: String,
		zip: String,
	},
	{ _id: false },
);

const OrderItemSchema = new mongoose.Schema(
	{
		partNumber: String,
		name: String,
		detail: String,
		qty: Number,
		unitPrice: Number,
		lineTotal: Number,
	},
	{ _id: false },
);

const OrderSchema = new mongoose.Schema(
	{
		orderNumber: { type: String, required: true, unique: true }, // e.g. IHI-2026-000123
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		customer: {
			firstName: String,
			lastName: String,
			email: String,
			phone: String,
			companyName: String,
		},

		billingAddress: AddressSchema,
		shippingAddress: AddressSchema,
		shippingSameAsBilling: { type: Boolean, default: true },

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
		adminReview: {
			status: {
				type: String,
				enum: [
					"PENDING",
					"APPROVED_IN_PROGRESS",
					"APPROVED_COMPLETED",
					"DENIED",
				],
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
