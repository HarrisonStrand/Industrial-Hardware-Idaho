import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

// Export a stable binding; it's either a Stripe instance or null.
export const stripe = key
  ? new Stripe(key, { apiVersion: "2024-06-20" })
  : null;

if (!key) {
  console.warn("⚠️ STRIPE_SECRET_KEY missing — billing endpoints will return 500 until configured.");
}
