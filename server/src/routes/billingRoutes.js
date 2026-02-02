import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { stripe } from "../utils/stripe.js";

const router = Router();

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || "",
    role: user.role,
    company: user.company || { name: "" },
    billingAddress: user.billingAddress || {},
    deliveryAddress: user.deliveryAddress || {},
    tax: user.tax || { status: "non_exempt" },
    avatarUrl: user.avatarUrl || "",
    avatarUpdatedAt: user.avatarUpdatedAt || null,
    payment: {
      hasCardOnFile: Boolean(user?.payment?.defaultPaymentMethodId)
    }
  };
}

/**
 * Create (or reuse) Stripe Customer, then create SetupIntent clientSecret.
 * Client confirms it with Stripe Elements, then calls /billing/confirm-setup to save defaults.
 */
router.post("/setup-intent", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Ensure payment subdoc exists (protect older users)
    if (!user.payment) user.payment = {};

    let customerId = user.payment?.stripeCustomerId || "";

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        phone: user.phone || undefined,
        metadata: { userId: user._id.toString() }
      });

      customerId = customer.id;
      user.payment.stripeCustomerId = customerId;
      await user.save();
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session"
    });

    return res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error("SETUP-INTENT ERROR:", err);
    return res.status(500).json({ error: "Failed to start card setup" });
  }
});

/**
 * After client confirms the setup, call this to:
 * - set default payment method on customer
 * - persist defaultPaymentMethodId in Mongo
 */
router.post("/confirm-setup", requireAuth, async (req, res) => {
  try {
    const { setupIntentId } = req.body || {};
    if (!setupIntentId) return res.status(400).json({ error: "Missing setupIntentId" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.payment) user.payment = {};

    const customerId = user.payment?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: "No Stripe customer found" });

    const si = await stripe.setupIntents.retrieve(setupIntentId);

    // Safety checks
    if (String(si.customer) !== String(customerId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (si.status !== "succeeded") {
      return res.status(400).json({ error: "Setup not complete" });
    }

    const paymentMethodId = si.payment_method;
    if (!paymentMethodId) return res.status(400).json({ error: "No payment method attached" });

    // Set customer default
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId }
    });

    // Persist in Mongo
    user.payment.defaultPaymentMethodId = paymentMethodId;
    await user.save();

    const fresh = await User.findById(user._id).lean();
    return res.json({ success: true, user: serializeUser(fresh) });
  } catch (err) {
    console.error("CONFIRM-SETUP ERROR:", err);
    return res.status(500).json({ error: "Failed to save card" });
  }
});

/**
 * Remove card on file (unset default + optionally detach)
 */
router.post("/remove-card", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.payment) user.payment = {};

    const customerId = user.payment?.stripeCustomerId;
    const pmId = user.payment?.defaultPaymentMethodId;

    if (customerId && pmId) {
      // Unset default
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: null }
      });

      // Detach PM (optional)
      try {
        await stripe.paymentMethods.detach(pmId);
      } catch (e) {
        console.warn("Detach PM failed (continuing):", e?.message || e);
      }
    }

    user.payment.defaultPaymentMethodId = "";
    await user.save();

    const fresh = await User.findById(user._id).lean();
    return res.json({ success: true, user: serializeUser(fresh) });
  } catch (err) {
    console.error("REMOVE-CARD ERROR:", err);
    return res.status(500).json({ error: "Failed to remove card" });
  }
});

router.get("/card-summary", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const customerId = user?.payment?.stripeCustomerId;
    const pmId = user?.payment?.defaultPaymentMethodId;

    if (!customerId || !pmId) {
      return res.json({ hasCardOnFile: false, card: null });
    }

    const pm = await stripe.paymentMethods.retrieve(pmId);

    // Ensure it belongs to that Stripe customer
    if (pm?.customer && String(pm.customer) !== String(customerId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const card = pm.card || null;
    if (!card) return res.json({ hasCardOnFile: true, card: null });

    return res.json({
      hasCardOnFile: true,
      card: {
        brand: card.brand || "",
        last4: card.last4 || "",
        expMonth: card.exp_month || null,
        expYear: card.exp_year || null
      }
    });
  } catch (err) {
    console.error("CARD-SUMMARY ERROR:", err);
    return res.status(500).json({ error: "Failed to load card summary" });
  }
});

export default router;
