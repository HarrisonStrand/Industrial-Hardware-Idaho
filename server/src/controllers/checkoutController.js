import Stripe from "stripe";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { generateOrderNumber } from "../utils/orderNumber.js";
import { normalizeOrderItems, calcAmountTotalCents } from "../utils/normalizeOrderItems.js";
import { buildPricingContextFromUser } from "../utils/resolveProductPrice.js";
import { sendOrderConfirmationForOrder } from "../utils/sendOrderConfirmationForOrder.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

function safeAddress(a) {
  const companyName = cleanText(a?.companyName || a?.name || "", 120);

  return {
    name: companyName,
    companyName,
    address1: a?.address1 || "",
    address2: a?.address2 || "",
    city: a?.city || "",
    state: a?.state || "",
    zip: a?.zip || "",
  };
}

function cleanText(value, max = 120) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

async function createUniqueOrderNumber() {
  try {
    return await generateOrderNumber();
  } catch (err) {
    if (err?.code === 11000) {
      return await generateOrderNumber();
    }
    throw err;
  }
}

async function ensureStripeCustomerForUser(user) {
  if (!stripe) throw new Error("Stripe is not configured on the server.");

  if (!user.payment) user.payment = {};

  let customerId = user.payment?.stripeCustomerId || "";
  if (customerId) return customerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
    phone: user.phone || undefined,
    metadata: { userId: String(user._id) },
  });

  customerId = customer.id;
  user.payment.stripeCustomerId = customerId;
  await user.save();
  return customerId;
}

function buildCustomerSnapshot(user, checkout = {}) {
  const checkoutCompanyName = cleanText(checkout.companyName, 120);

  return {
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    phone: user.phone || "",
    companyName: checkoutCompanyName || user.company?.name || user.companyName || "",
  };
}

async function buildNormalizedOrderPayload({
  user,
  items,
  billingAddress,
  shippingAddress,
  shippingSameAsBilling = true,
  currency = "usd",
  paymentMode = "PAY_NOW",
  paymentStatus = "PENDING",
  pricingContext = {},
  companyName = "",
  poNumber = "",
}) {
  const normalizedItems = await normalizeOrderItems(items, {
    pricingContext,
    repriceFromProducts: true,
  });

  if (!normalizedItems.length) {
    const err = new Error("Cart is empty");
    err.statusCode = 400;
    throw err;
  }

  const amountTotalCents = calcAmountTotalCents(normalizedItems);
  if (!amountTotalCents || amountTotalCents <= 0) {
    const err = new Error("Invalid order total");
    err.statusCode = 400;
    throw err;
  }

  return {
    userId: user._id,
    customer: buildCustomerSnapshot(user, { companyName }),
    poNumber: cleanText(poNumber, 64),
    customerPO: cleanText(poNumber, 64),
    purchaseOrderNumber: cleanText(poNumber, 64),
    billingAddress: safeAddress({
      ...(billingAddress || user.billingAddress || {}),
      companyName: companyName || billingAddress?.companyName || billingAddress?.name || user.billingAddress?.companyName || user.billingAddress?.name || "",
    }),
    shippingAddress: safeAddress(
      shippingSameAsBilling
        ? {
            ...(billingAddress || user.billingAddress || {}),
            companyName: companyName || billingAddress?.companyName || billingAddress?.name || user.billingAddress?.companyName || user.billingAddress?.name || "",
          }
        : shippingAddress || user.deliveryAddress
    ),
    shippingSameAsBilling: Boolean(shippingSameAsBilling),
    items: normalizedItems,
    currency,
    amountTotalCents,
    payment: {
      mode: paymentMode,
      status: paymentStatus,
      stripePaymentIntentId: "",
    },
  };
}

export async function getCapabilities(req, res) {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const account = user.account || {};
  const approvedType = account.approvedType || "RETAIL";
  const approvalStatus = account.approvalStatus || "NONE";

  const hasCardOnFile = Boolean(user?.payment?.defaultPaymentMethodId);

  return res.json({
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
    return res.status(400).json({ error: "requestedType must be NET30 or HOUSE" });
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
  try {
    const { payLaterType, items = [], companyName = "", poNumber = "", customerPO = "" } = req.body || {};

    if (!["NET30", "HOUSE"].includes(payLaterType)) {
      return res.status(400).json({ error: "payLaterType must be NET30 or HOUSE" });
    }

    const user = await User.findById(req.user.id);
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

    const pricingContext = await buildPricingContextFromUser(user);

    const baseOrderData = await buildNormalizedOrderPayload({
      user,
      items,
      billingAddress: user.billingAddress,
      shippingAddress: user.deliveryAddress,
      shippingSameAsBilling: false,
      currency: "usd",
      paymentMode: "PAY_LATER",
      paymentStatus: "INVOICED",
      pricingContext,
      companyName,
      poNumber: poNumber || customerPO,
    });

    const order = await Order.create({
      ...baseOrderData,
      orderNumber: await createUniqueOrderNumber(),
    });

    await sendOrderConfirmationForOrder(order).catch((emailErr) => {
      console.error("PAY-LATER CONFIRMATION EMAIL ERROR:", emailErr);
    });

    return res.status(201).json({
      success: true,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    console.error("PAY-LATER ORDER ERROR:", err);
    return res.status(err?.statusCode || 500).json({
      error: err?.message || "Failed to create pay-later order",
    });
  }
}

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
      items = [],
      billingAddress,
      shippingAddress,
      shippingSameAsBilling = true,
      companyName = "",
      poNumber = "",
      customerPO = "",
    } = req.body || {};

    const pricingContext = await buildPricingContextFromUser(user);

    const baseOrderData = await buildNormalizedOrderPayload({
      user,
      items,
      billingAddress,
      shippingAddress,
      shippingSameAsBilling,
      currency,
      paymentMode: "PAY_NOW",
      paymentStatus: "PENDING",
      pricingContext,
      companyName,
      poNumber: poNumber || customerPO,
    });

    if (Number.isFinite(Number(amountCents)) && Number(amountCents) > 0) {
      const clientAmount = Number(amountCents);
      if (Math.abs(clientAmount - baseOrderData.amountTotalCents) > 1) {
        return res.status(400).json({
          error: "Cart total mismatch. Please refresh your cart and try again.",
        });
      }
    }

    const order = await Order.create({
      ...baseOrderData,
      orderNumber: await createUniqueOrderNumber(),
    });

    const stripePayload = {
      amount: baseOrderData.amountTotalCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: String(user._id),
      },
    };

    if (saveThisCard) {
      const customerId = await ensureStripeCustomerForUser(user);
      stripePayload.customer = customerId;
      stripePayload.setup_future_usage = "off_session";
    }

    const pi = await stripe.paymentIntents.create(stripePayload);

    order.payment.stripePaymentIntentId = pi.id;
    await order.save();

    return res.json({
      clientSecret: pi.client_secret,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    console.error("PAY-NOW INTENT ERROR:", err);

    const stripeMsg =
      err?.raw?.message || err?.message || "Failed to create payment intent";

    return res.status(err?.statusCode || 500).json({
      error: stripeMsg,
      code: err?.code || err?.raw?.code || null,
    });
  }
}

export async function payNowWithSavedCard(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured on the server." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const {
      amountCents,
      currency = "usd",
      items = [],
      billingAddress,
      shippingAddress,
      shippingSameAsBilling = true,
      companyName = "",
      poNumber = "",
      customerPO = "",
    } = req.body || {};

    const customerId = user.payment?.stripeCustomerId;
    const pmId = user.payment?.defaultPaymentMethodId;

    if (!customerId || !pmId) {
      return res.status(400).json({ error: "No saved card on file" });
    }

    const pricingContext = await buildPricingContextFromUser(user);

    const baseOrderData = await buildNormalizedOrderPayload({
      user,
      items,
      billingAddress,
      shippingAddress,
      shippingSameAsBilling,
      currency,
      paymentMode: "PAY_NOW",
      paymentStatus: "PENDING",
      pricingContext,
      companyName,
      poNumber: poNumber || customerPO,
    });

    if (Number.isFinite(Number(amountCents)) && Number(amountCents) > 0) {
      const clientAmount = Number(amountCents);
      if (Math.abs(clientAmount - baseOrderData.amountTotalCents) > 1) {
        return res.status(400).json({
          error: "Cart total mismatch. Please refresh your cart and try again.",
        });
      }
    }

    const order = await Order.create({
      ...baseOrderData,
      orderNumber: await createUniqueOrderNumber(),
    });

    const pi = await stripe.paymentIntents.create({
      amount: baseOrderData.amountTotalCents,
      currency,
      customer: customerId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: String(user._id),
      },
    });

    order.payment.stripePaymentIntentId = pi.id;
    if (pi.status === "succeeded") {
      order.payment.status = "SUCCEEDED";
    } else if (pi.status === "requires_payment_method" || pi.status === "canceled") {
      order.payment.status = "FAILED";
    }
    await order.save();

    if (order.payment.status === "SUCCEEDED") {
      await sendOrderConfirmationForOrder(order).catch((emailErr) => {
        console.error("SAVED-CARD CONFIRMATION EMAIL ERROR:", emailErr);
      });
    }

    return res.json({
      success: true,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      paymentIntentId: pi.id,
      status: pi.status,
    });
  } catch (err) {
    console.error("PAY-NOW SAVED-CARD ERROR:", err);
    const msg = err?.raw?.message || err?.message || "Failed to charge saved card";
    return res.status(err?.statusCode || 500).json({ error: msg });
  }
}