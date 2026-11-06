import express from "express";
import PricingSettings from "../models/PricingSettings.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  DEFAULT_ACCOUNT_PRICE_RULES,
  sanitizeAccountRules,
} from "../config/pricingRules.js";
import { sanitizeFixedPriceGroups } from "../config/fixedPriceGroups.js";
import {
  PRICE_MODES,
  clearPricingSettingsCache,
  getPricingSettings,
} from "../utils/resolveProductPrice.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const settings = await getPricingSettings({ forceRefresh: true });
    return res.json(settings);
  } catch (err) {
    console.error("Admin pricing settings GET error:", err);
    return res.status(500).json({ message: "Failed to load pricing settings" });
  }
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Each part is saved only when it is sent, so saving one setting (e.g. the price mode) never
    // resets the markups or the groups.
    const update = { updatedBy: req.user?.id || null };
    if (req.body?.accountRules && typeof req.body.accountRules === "object") {
      update.accountRules = sanitizeAccountRules(req.body.accountRules);
    }
    if (Array.isArray(req.body?.fixedPriceGroups)) {
      update.fixedPriceGroups = sanitizeFixedPriceGroups(req.body.fixedPriceGroups);
    }
    if (PRICE_MODES.includes(req.body?.priceMode)) {
      update.priceMode = req.body.priceMode;
    }

    const doc = await PricingSettings.findOneAndUpdate(
      { key: "default" },
      { $set: update },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    clearPricingSettingsCache();

    return res.json({
      success: true,
      settings: {
        key: doc.key,
        accountRules: sanitizeAccountRules(doc.accountRules),
        fixedPriceGroups: sanitizeFixedPriceGroups(doc.toObject().fixedPriceGroups),
        priceMode: PRICE_MODES.includes(doc.priceMode) ? doc.priceMode : "markup",
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    console.error("Admin pricing settings PUT error:", err);
    return res.status(500).json({ message: "Failed to save pricing settings" });
  }
});

export default router;