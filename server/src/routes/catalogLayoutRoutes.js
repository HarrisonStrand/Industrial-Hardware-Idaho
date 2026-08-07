import express from "express";

import { optionalAuth } from "../middleware/auth.js";
import CatalogSubcategorySetting, { DISPLAY_MODES } from "../models/CatalogSubcategorySetting.js";
import {
  ensureCatalogLayoutRecords,
  getCatalogGlobalSetting,
  getCatalogSubcategorySetting,
  normalizeCatalogId,
  resolveEffectiveCatalogMode,
} from "../services/catalog/catalogLayoutDefaults.js";
import getCatalogRangeSummary from "../services/catalog/getCatalogRangeSummary.js";

const router = express.Router();

function toPublicSetting(setting, globalSetting) {
  const effectiveMode = resolveEffectiveCatalogMode(setting, globalSetting);

  return {
    categoryId: setting.categoryId,
    categoryName: setting.categoryName || "",
    subcategoryId: setting.subcategoryId,
    displayName: setting.displayName || "",
    requestedMode: setting.displayMode,
    effectiveMode,
    fallbackMode: setting.fallbackMode,
    isVisible: setting.isVisible !== false,
    showPricing: !!setting.showPricing,
    allowCart: !!setting.allowCart,
    rangeDataSource: setting.rangeDataSource || "ready",
    image: setting.image || { url: "", alt: "" },
    introText: setting.introText || "",
    contactMessage: setting.contactMessage || "",
    primaryAction: setting.primaryAction || "contact",
    sortOrder: Number(setting.sortOrder || 0),
  };
}

router.get("/", async (_req, res) => {
  try {
    await ensureCatalogLayoutRecords();
    const globalSetting = await getCatalogGlobalSetting();
    const settings = await CatalogSubcategorySetting.find({})
      .sort({ sortOrder: 1, categoryName: 1, displayName: 1 })
      .lean();

    return res.json({
      global: {
        buildersEnabled: globalSetting?.buildersEnabled !== false,
      },
      items: settings.map((setting) => toPublicSetting(setting, globalSetting)),
    });
  } catch (error) {
    console.error("Public catalog layout list error:", error);
    return res.status(500).json({ message: "Failed to load catalog layout" });
  }
});

router.get("/:categoryId/:subcategoryId", optionalAuth, async (req, res) => {
  try {
    const categoryId = normalizeCatalogId(req.params.categoryId);
    const subcategoryId = normalizeCatalogId(req.params.subcategoryId);
    const isAdmin = req.user?.role === "admin";

    const [setting, globalSetting] = await Promise.all([
      getCatalogSubcategorySetting(categoryId, subcategoryId),
      getCatalogGlobalSetting(),
    ]);

    if (!setting) {
      return res.status(404).json({ message: "Catalog page not found" });
    }

    const publicSetting = toPublicSetting(setting, globalSetting);
    const previewMode =
      isAdmin && DISPLAY_MODES.includes(String(req.query?.previewMode || ""))
        ? String(req.query.previewMode)
        : "";

    if (previewMode) {
      publicSetting.effectiveMode = previewMode;
    }

    if ((!publicSetting.isVisible || publicSetting.effectiveMode === "hidden") && !isAdmin) {
      return res.status(404).json({ message: "Catalog page not found" });
    }

    const response = {
      global: {
        buildersEnabled: globalSetting?.buildersEnabled !== false,
      },
      page: publicSetting,
      isAdmin,
      adminPreview: isAdmin && (!publicSetting.isVisible || !!previewMode),
      previewMode: previewMode || null,
      rangeSummary: null,
    };

    if (publicSetting.effectiveMode === "range-list") {
      response.rangeSummary = await getCatalogRangeSummary(
        categoryId,
        subcategoryId,
        { rangeDataSource: publicSetting.rangeDataSource }
      );
    }

    return res.json(response);
  } catch (error) {
    console.error("Public catalog layout page error:", error);
    return res.status(500).json({ message: "Failed to load catalog page" });
  }
});

export default router;
