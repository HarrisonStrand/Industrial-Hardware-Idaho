import express from "express";
import { Router } from "express";
import Stripe from "stripe";
import Order from "../models/Order.js";
import { sendOrderConfirmationForOrder } from "../utils/sendOrderConfirmationForOrder.js";
import { pushOrderToFishbowl } from "../services/fishbowl/pushOrderToFishbowl.js";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

// IMPORTANT: Stripe webhooks require the RAW body
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const orderId = pi?.metadata?.orderId;

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order) {
            // Idempotency: only transition once
            const wasSucceeded = order.payment.status === "SUCCEEDED";

            order.payment.status = "SUCCEEDED";
            order.payment.stripePaymentIntentId = pi.id;
            await order.save();

            const autoPush = String(process.env.FISHBOWL_AUTO_PUSH_ON_PAYMENT_SUCCESS || "false") === "true";
            if (autoPush) {
              await pushOrderToFishbowl(order._id);
            }

            if (!wasSucceeded) {
              await sendOrderConfirmationForOrder(order);
            }
          }
        }
      }

      if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        const orderId = pi?.metadata?.orderId;

        if (orderId) {
          await Order.findByIdAndUpdate(orderId, {
            $set: {
              "payment.status": "FAILED",
              "payment.stripePaymentIntentId": pi.id
            }
          });
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
);

export default router;