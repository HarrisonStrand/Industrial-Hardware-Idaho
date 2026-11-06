import express from "express";
import PricingSettings from "../models/PricingSettings.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  DEFAULT_ACCOUNT_PRICE_RULES,
  sanitizeAccountRules,
} from "../config/pricingRules.js";
import { sanitizeFixedPriceGroups } from "../config/fixedPriceGroups.js";
import {
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
    const nextRules = sanitizeAccountRules(
      req.body?.accountRules || DEFAULT_ACCOUNT_PRICE_RULES
    );

    const update = {
      accountRules: nextRules,
      updatedBy: req.user?.id || null,
    };
    // Only saved when sent, so an older admin page never wipes the groups.
    if (Array.isArray(req.body?.fixedPriceGroups)) {
      update.fixedPriceGroups = sanitizeFixedPriceGroups(req.body.fixedPriceGroups);
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
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    console.error("Admin pricing settings PUT error:", err);
    return res.status(500).json({ message: "Failed to save pricing settings" });
  }
});

export default router;