
import express from "express";
import { Router } from "express";
import Stripe from "stripe";
import Order from "../models/Order.js";
import { sendOrderConfirmationForOrder } from "../utils/sendOrderConfirmationForOrder.js";
import { pushOrderToFishbowl } from "../services/fishbowl/pushOrderToFishbowl.js";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return res.status(500).send("Webhook not configured");
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        secret
      );
    } catch (err) {
      console.error("Stripe signature error:", err.message);
      return res.status(400).send("Invalid webhook signature");
    }

    try {
      const supportedEvents = [
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
      ];

      if (!supportedEvents.includes(event.type)) {
        return res.json({ received: true });
      }

      const pi = event.data.object;
      const orderId = pi?.metadata?.orderId;

      if (!orderId) {
        console.error("PaymentIntent missing orderId", pi.id);
        return res.status(500).send("Missing order reference");
      }

      const order = await Order.findById(orderId);

      if (!order) {
        console.error("Order not found for PaymentIntent", pi.id);
        return res.status(500).send("Order not found");
      }

      // Do not let an unrelated PaymentIntent modify the order.
      const recordedId = order.payment?.stripePaymentIntentId;

      if (recordedId && recordedId !== pi.id) {
        console.error("PaymentIntent ID mismatch", {
          orderId,
          paymentIntentId: pi.id,
        });
        return res.status(409).send("PaymentIntent mismatch");
      }

      if (
        order.payment?.mode !== "PAY_NOW" ||
        Number(order.amountTotalCents) !== Number(pi.amount) ||
        String(order.currency).toLowerCase() !==
          String(pi.currency).toLowerCase()
      ) {
        console.error("PaymentIntent order details mismatch", {
          orderId,
          paymentIntentId: pi.id,
        });
        return res.status(409).send("Order details mismatch");
      }

      // Handle successful payment.
      if (event.type === "payment_intent.succeeded") {
        // Only this associated PaymentIntent can update payment.
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: orderId,
            "payment.mode": "PAY_NOW",
            $or: [
              { "payment.stripePaymentIntentId": pi.id },
              { "payment.stripePaymentIntentId": "" },
              { "payment.stripePaymentIntentId": { $exists: false } },
            ],
          },
          {
            $set: {
              "payment.status": "SUCCEEDED",
              "payment.stripePaymentIntentId": pi.id,
            },
          },
          { new: true }
        );

        if (!updatedOrder) {
          return res.status(409).send("Payment association changed");
        }

        // The utility checks email sentAt fields.
        // Run it even if payment was already SUCCEEDED.
        const emailResult = await sendOrderConfirmationForOrder(
          updatedOrder
        );

        if (emailResult?.customer?.error ||
            emailResult?.admin?.error) {
          console.warn("Order notification requires review", {
            orderId,
            emailResult,
          });
        }

        // Keep this flag FALSE during initial Stripe testing.
        const autoPush =
          process.env.FISHBOWL_AUTO_PUSH_ON_PAYMENT_SUCCESS ===
          "true";

        if (autoPush) {
          await pushOrderToFishbowl(orderId);
        }

        return res.json({ received: true });
      }

      // A failure event must never overwrite a paid order.
      if (event.type === "payment_intent.payment_failed") {
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            "payment.mode": "PAY_NOW",
            "payment.status": { $ne: "SUCCEEDED" },
            $or: [
              { "payment.stripePaymentIntentId": pi.id },
              { "payment.stripePaymentIntentId": "" },
              { "payment.stripePaymentIntentId": { $exists: false } },
            ],
          },
          {
            $set: {
              "payment.status": "FAILED",
              "payment.stripePaymentIntentId": pi.id,
            },
          }
        );
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook handler error:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
);

export default router;
