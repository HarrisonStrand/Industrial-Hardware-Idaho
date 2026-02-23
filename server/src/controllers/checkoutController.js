import User from "../models/User.js";
import { stripe } from "../utils/stripe.js";
import Order from "../models/Order.js";
import { generateOrderNumber } from "../utils/orderNumber.js";

function calcTotals(items) {
	const subtotal = items.reduce(
		(sum, it) => sum + Number(it.lineTotal || 0),
		0,
	);
	const tax = 0;
	const shipping = 0;
	const total = subtotal + tax + shipping;
	return { subtotal, tax, shipping, total };
}

export async function getCapabilities(req, res) {
	const user = await User.findById(req.user.id).lean();
	if (!user) return res.status(404).json({ error: "User not found" });

	const account = user.account || {};
	const approvedType = account.approvedType || "RETAIL";
	const approvalStatus = account.approvalStatus || "NONE";

	const hasCardOnFile = Boolean(user?.payment?.defaultPaymentMethodId);

	res.json({
		account: {
			requestedType: account.requestedType || "RETAIL",
			approvedType,
			approvalStatus,
			rejectionReason: account.rejectionReason || "",
		},
		payment: { hasCardOnFile },
		canUseNet30: approvalStatus === "APPROVED" && approvedType === "NET30",
		canUseHouse: approvalStatus === "APPROVED" && approvedType === "HOUSE",
	});
}

export async function requestAccountType(req, res) {
	const { requestedType } = req.body || {};
	if (!["NET30", "HOUSE"].includes(requestedType)) {
		return res
			.status(400)
			.json({ error: "requestedType must be NET30 or HOUSE" });
	}

	const user = await User.findById(req.user.id);
	if (!user) return res.status(404).json({ error: "User not found" });

	user.account = user.account || {};
	user.account.requestedType = requestedType;
	user.account.approvalStatus = "PENDING";
	user.account.rejectionReason = "";
	await user.save();

	return res.json({ success: true });
}

export async function createPayLaterOrder(req, res) {
	const { payLaterType, items, notes } = req.body || {};

	if (!["NET30", "HOUSE"].includes(payLaterType)) {
		return res
			.status(400)
			.json({ error: "payLaterType must be NET30 or HOUSE" });
	}

	if (!Array.isArray(items) || items.length === 0) {
		return res.status(400).json({ error: "Cart is empty" });
	}

	const user = await User.findById(req.user.id).lean();
	if (!user) return res.status(404).json({ error: "User not found" });

	const account = user.account || {};
	const approved = account.approvalStatus === "APPROVED";
	const matches =
		(payLaterType === "NET30" && account.approvedType === "NET30") ||
		(payLaterType === "HOUSE" && account.approvedType === "HOUSE");

	if (!approved || !matches) {
		return res.status(403).json({
			error: "Pay later requires admin approval.",
			approvalStatus: account.approvalStatus || "NONE",
			approvedType: account.approvedType || "RETAIL",
		});
	}

	const totals = calcTotals(items);

	const order = await Order.create({
		userId: user._id,
		items,
		...totals,
		billingAddress: user.billingAddress || {},
		deliveryAddress: user.deliveryAddress || {},
		paymentMode: "PAY_LATER",
		payLaterType,
		paymentStatus: "UNPAID",
		status: "PENDING",
		notes: notes || "",
	});

	return res.status(201).json({ orderId: order._id });
}

function safeAddress(a) {
  return {
    address1: a?.address1 || "",
    address2: a?.address2 || "",
    city: a?.city || "",
    state: a?.state || "",
    zip: a?.zip || ""
  };
}

/**
 * POST /api/checkout/pay-now/intent
 * Creates an Order (PENDING) and a PaymentIntent (not confirmed).
 * Client confirms via Stripe Elements.
 */
export async function createPayNowIntent(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured on the server." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const {
      amountCents,
      currency = "usd",
      saveThisCard = false,
      // optional order snapshot if you want to send it from client:
      items = [],
      billingAddress,
      shippingAddress,
      shippingSameAsBilling = true
    } = req.body || {};

    const amountTotalCents = Number(amountCents || 0);
    if (!Number.isFinite(amountTotalCents) || amountTotalCents <= 0) {
      return res.status(400).json({ error: "Invalid amountCents" });
    }

    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      userId: user._id,
      customer: {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        companyName: user.company?.name || ""
      },
      billingAddress: safeAddress(billingAddress || user.billingAddress),
      shippingAddress: safeAddress(
        shippingSameAsBilling
          ? (billingAddress || user.billingAddress)
          : (shippingAddress || user.deliveryAddress)
      ),
      shippingSameAsBilling: Boolean(shippingSameAsBilling),
      items: Array.isArray(items) ? items : [],
      currency,
      amountTotalCents,
      payment: { mode: "PAY_NOW", status: "PENDING" }
    });

    const pi = await stripe.paymentIntents.create({
      amount: amountTotalCents,
      currency,
      automatic_payment_methods: { enabled: true },
      ...(saveThisCard ? { setup_future_usage: "off_session" } : {}),
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: String(user._id)
      }
    });

    // store PI id for reference
    order.payment.stripePaymentIntentId = pi.id;
    await order.save();

    return res.json({
      clientSecret: pi.client_secret,
      orderId: String(order._id),
      orderNumber: order.orderNumber
    });
  } catch (err) {
    console.error("PAY-NOW INTENT ERROR:", err);
    return res.status(500).json({ error: "Failed to create payment intent" });
  }
}

/**
 * POST /api/checkout/pay-now/saved-card
 * Creates an Order (PENDING) and charges immediately using the user's saved default PM.
 * Webhook will mark SUCCEEDED and send email.
 */
export async function payNowWithSavedCard(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured on the server." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { amountCents, currency = "usd", items = [], billingAddress, shippingAddress, shippingSameAsBilling = true } =
      req.body || {};

    const amountTotalCents = Number(amountCents || 0);
    if (!Number.isFinite(amountTotalCents) || amountTotalCents <= 0) {
      return res.status(400).json({ error: "Invalid amountCents" });
    }

    const customerId = user.payment?.stripeCustomerId;
    const pmId = user.payment?.defaultPaymentMethodId;

    if (!customerId || !pmId) {
      return res.status(400).json({ error: "No saved card on file" });
    }

    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      userId: user._id,
      customer: {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        companyName: user.company?.name || ""
      },
      billingAddress: safeAddress(billingAddress || user.billingAddress),
      shippingAddress: safeAddress(
        shippingSameAsBilling
          ? (billingAddress || user.billingAddress)
          : (shippingAddress || user.deliveryAddress)
      ),
      shippingSameAsBilling: Boolean(shippingSameAsBilling),
      items: Array.isArray(items) ? items : [],
      currency,
      amountTotalCents,
      payment: { mode: "PAY_NOW", status: "PENDING" }
    });

    const pi = await stripe.paymentIntents.create({
      amount: amountTotalCents,
      currency,
      customer: customerId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: String(user._id)
      }
    });

    order.payment.stripePaymentIntentId = pi.id;
    // If it succeeded immediately, we can update now (webhook will also fire; idempotent)
    if (pi.status === "succeeded") {
      order.payment.status = "SUCCEEDED";
    } else if (pi.status === "requires_payment_method" || pi.status === "canceled") {
      order.payment.status = "FAILED";
    }
    await order.save();

    return res.json({
      success: true,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      paymentIntentId: pi.id,
      status: pi.status
    });
  } catch (err) {
    console.error("PAY-NOW SAVED-CARD ERROR:", err);

    // Stripe might throw card_declined, authentication_required, etc.
    const msg = err?.raw?.message || err?.message || "Failed to charge saved card";
    return res.status(500).json({ error: msg });
  }
}

export async function chargeSavedCardPayNow(req, res) {
	if (!stripe)
		return res
			.status(500)
			.json({ error: "Stripe is not configured on the server." });

	try {
		const { amountCents, currency = "usd" } = req.body || {};
		if (!amountCents || Number(amountCents) <= 0) {
			return res.status(400).json({ error: "Missing or invalid amountCents" });
		}

		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ error: "User not found" });

		const customerId = user.payment?.stripeCustomerId;
		const pmId = user.payment?.defaultPaymentMethodId;

		if (!customerId || !pmId) {
			return res.status(400).json({ error: "No saved card on file" });
		}

		const pi = await stripe.paymentIntents.create({
			amount: Number(amountCents),
			currency,
			customer: customerId,
			payment_method: pmId,
			off_session: true,
			confirm: true,
			metadata: { userId: user._id.toString() },
		});

		// ✅ Later: create PAID order + return orderId for confirmation page
		return res.json({ success: true, paymentIntentId: pi.id });
	} catch (err) {
		console.error("PAY-NOW SAVED-CARD ERROR:", err);
		return res.status(500).json({ error: "Failed to charge saved card" });
	}
}
