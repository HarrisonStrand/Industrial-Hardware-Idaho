import express from "express";
import User from "../models/User.js";
import { optionalAuth } from "../middleware/auth.js";
import getCatalogBuilderSubcategory from "../services/catalog/getCatalogBuilderSubcategory.js";
import { buildPricingContextFromUser } from "../utils/resolveProductPrice.js";
import {
  getCatalogGlobalSetting,
  getCatalogSubcategorySetting,
  resolveEffectiveCatalogMode,
} from "../services/catalog/catalogLayoutDefaults.js";

const router = express.Router();

router.get("/:categoryId/:subcategoryId", optionalAuth, async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;
    const wantsUnpublishedPreview = req.query?.includeUnpublished === "true";
    const isAdmin = req.user?.role === "admin";

    const [layoutSetting, globalSetting] = await Promise.all([
      getCatalogSubcategorySetting(categoryId, subcategoryId),
      getCatalogGlobalSetting(),
    ]);

    const effectiveMode = layoutSetting
      ? resolveEffectiveCatalogMode(layoutSetting, globalSetting)
      : "hidden";

    if (
      !isAdmin &&
      (!layoutSetting || layoutSetting.isVisible === false || effectiveMode !== "builder")
    ) {
      return res.status(404).json({ message: "Product builder is not available" });
    }

    if (wantsUnpublishedPreview && !isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    let pricingContext = {
      approvedType: "RETAIL",
      approvalStatus: "NONE",
    };

    if (req.user?.id) {
      const user = await User.findById(req.user.id).lean();
      if (user) {
        pricingContext = await buildPricingContextFromUser(user);
      }
    }

    const result = await getCatalogBuilderSubcategory(
      categoryId,
      subcategoryId,
      {
        pricingContext,
        includeUnpublished: wantsUnpublishedPreview && isAdmin,
        isAdmin,
      }
    );

    return res.json(result);
  } catch (err) {
    console.error("Catalog builder route error:", err);
    return res.status(500).json({
      message: "Catalog builder failed",
    });
  }
});

export default router;
