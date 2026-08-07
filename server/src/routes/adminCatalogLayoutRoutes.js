import express from "express";

import { requireAuth, requireAdmin } from "../middleware/auth.js";
import CatalogGlobalSetting from "../models/CatalogGlobalSetting.js";
import CatalogSubcategorySetting, {
  DISPLAY_MODES,
  FALLBACK_MODES,
  RANGE_DATA_SOURCES,
  PRIMARY_ACTIONS,
} from "../models/CatalogSubcategorySetting.js";
import ProductEnrichment from "../models/ProductEnrichment.js";
import {
  ensureCatalogLayoutRecords,
  getCatalogGlobalSetting,
  normalizeCatalogId,
  resolveEffectiveCatalogMode,
} from "../services/catalog/catalogLayoutDefaults.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

function stringValue(value = "") {
  return String(value || "").trim();
}

function enumValue(value, allowed, fallback) {
  const next = stringValue(value);
  return allowed.includes(next) ? next : fallback;
}

async function buildStatsMap() {
  const rows = await ProductEnrichment.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: {
          category: "$category",
          subcategory: "$subcategory",
        },
        totalProducts: { $sum: 1 },
        activeProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$product.isActive", false] },
                  { $ne: ["$product.fishbowl.active", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
        publishedProducts: {
          $sum: { $cond: [{ $eq: ["$product.isPublished", true] }, 1, 0] },
        },
        approvedProducts: {
          $sum: {
            $cond: [{ $eq: ["$product.review.status", "approved"] }, 1, 0],
          },
        },
        readyProducts: {
          $sum: {
            $cond: [{ $eq: ["$product.review.status", "ready"] }, 1, 0],
          },
        },
        builderReadyProducts: {
          $sum: {
            $cond: [{ $eq: ["$quality.builderReady", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => {
      const key = `${normalizeCatalogId(row?._id?.category)}/${normalizeCatalogId(
        row?._id?.subcategory
      )}`;
      return [
        key,
        {
          totalProducts: Number(row.totalProducts || 0),
          activeProducts: Number(row.activeProducts || 0),
          publishedProducts: Number(row.publishedProducts || 0),
          approvedProducts: Number(row.approvedProducts || 0),
          readyProducts: Number(row.readyProducts || 0),
          builderReadyProducts: Number(row.builderReadyProducts || 0),
        },
      ];
    })
  );
}

router.get("/", async (_req, res) => {
  try {
    await ensureCatalogLayoutRecords();

    const [globalSetting, settings, statsMap] = await Promise.all([
      getCatalogGlobalSetting(),
      CatalogSubcategorySetting.find({})
        .sort({ sortOrder: 1, categoryName: 1, displayName: 1 })
        .lean(),
      buildStatsMap(),
    ]);

    return res.json({
      global: {
        buildersEnabled: globalSetting?.buildersEnabled !== false,
        updatedAt: globalSetting?.updatedAt || null,
      },
      options: {
        displayModes: DISPLAY_MODES,
        fallbackModes: FALLBACK_MODES,
        rangeDataSources: RANGE_DATA_SOURCES,
        primaryActions: PRIMARY_ACTIONS,
      },
      items: settings.map((setting) => {
        const key = `${setting.categoryId}/${setting.subcategoryId}`;
        return {
          ...setting,
          effectiveMode: resolveEffectiveCatalogMode(setting, globalSetting),
          stats: statsMap.get(key) || {
            totalProducts: 0,
            activeProducts: 0,
            publishedProducts: 0,
            approvedProducts: 0,
            readyProducts: 0,
            builderReadyProducts: 0,
          },
        };
      }),
    });
  } catch (error) {
    console.error("Admin catalog layout list error:", error);
    return res.status(500).json({ message: "Failed to load catalog layout settings" });
  }
});

router.put("/global", async (req, res) => {
  try {
    const doc = await CatalogGlobalSetting.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          buildersEnabled: req.body?.buildersEnabled === true,
          updatedBy: req.user?.id || null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      global: {
        buildersEnabled: doc.buildersEnabled !== false,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    console.error("Admin catalog global setting update error:", error);
    return res.status(500).json({ message: "Failed to update builder setting" });
  }
});

router.put("/:categoryId/:subcategoryId", async (req, res) => {
  try {
    await ensureCatalogLayoutRecords();

    const categoryId = normalizeCatalogId(req.params.categoryId);
    const subcategoryId = normalizeCatalogId(req.params.subcategoryId);
    const existing = await CatalogSubcategorySetting.findOne({
      categoryId,
      subcategoryId,
    });

    if (!existing) {
      return res.status(404).json({ message: "Catalog subcategory setting not found" });
    }

    const body = req.body || {};

    existing.displayMode = enumValue(
      body.displayMode,
      DISPLAY_MODES,
      existing.displayMode
    );
    existing.fallbackMode = enumValue(
      body.fallbackMode,
      FALLBACK_MODES,
      existing.fallbackMode
    );
    existing.rangeDataSource = enumValue(
      body.rangeDataSource,
      RANGE_DATA_SOURCES,
      existing.rangeDataSource
    );
    existing.primaryAction = enumValue(
      body.primaryAction,
      PRIMARY_ACTIONS,
      existing.primaryAction
    );

    if (typeof body.isVisible === "boolean") existing.isVisible = body.isVisible;
    if (typeof body.showPricing === "boolean") existing.showPricing = body.showPricing;
    if (typeof body.allowCart === "boolean") existing.allowCart = body.allowCart;

    if (body.displayName !== undefined) existing.displayName = stringValue(body.displayName);
    if (body.introText !== undefined) existing.introText = stringValue(body.introText);
    if (body.contactMessage !== undefined) {
      existing.contactMessage = stringValue(body.contactMessage);
    }
    if (body.adminNotes !== undefined) existing.adminNotes = stringValue(body.adminNotes);

    if (body.image && typeof body.image === "object") {
      existing.image = {
        url: stringValue(body.image.url),
        alt: stringValue(body.image.alt || existing.displayName),
      };
    }

    existing.updatedBy = req.user?.id || null;
    await existing.save();

    const globalSetting = await getCatalogGlobalSetting();

    return res.json({
      success: true,
      item: {
        ...existing.toObject(),
        effectiveMode: resolveEffectiveCatalogMode(existing, globalSetting),
      },
    });
  } catch (error) {
    console.error("Admin catalog subcategory update error:", error);
    return res.status(500).json({ message: "Failed to update catalog subcategory" });
  }
});

export default router;
