import express from "express";
import getPublishedCatalog from "../services/catalog/getPublishedCatalog.js";
import getPublishedProductBySlug from "../services/catalog/getPublishedProductBySlug.js";
import User from "../models/User.js";
import { optionalAuth } from "../middleware/auth.js";
import { buildPricingContextFromUser } from "../utils/resolveProductPrice.js";

const router = express.Router();

// GET /api/catalog
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      category,
      subcategory,
      search,
      productType,
      grade,
      materialFinish,
      measurementSystem,
      limit,
      skip,
    } = req.query;

    // Page attribute filters arrive as attr.<key>=value; the service keeps only the page's own keys.
    const attributeFilters = Object.fromEntries(
      Object.entries(req.query)
        .filter(([key, value]) => key.startsWith("attr.") && typeof value === "string")
        .map(([key, value]) => [key.slice(5), value])
    );

    // Signed-in accounts see their own prices, the same as on builder pages and at checkout.
    let pricingContext = { approvedType: "RETAIL", approvalStatus: "NONE" };
    if (req.user?.id) {
      const user = await User.findById(req.user.id).lean();
      if (user) pricingContext = await buildPricingContextFromUser(user);
    }

    const result = await getPublishedCatalog({
      pricingContext,
      category,
      subcategory,
      search,
      productType,
      grade,
      materialFinish,
      measurementSystem,
      attributeFilters,
      limit,
      skip,
    });

    return res.json(result);
  } catch (error) {
    console.error("Catalog list error:", error);
    return res.status(500).json({
      message: "Failed to fetch catalog",
    });
  }
});

// GET /api/catalog/product/:slug
router.get("/product/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await getPublishedProductBySlug(slug);

    if (!result) {
      return res.status(404).json({
        message: "Published product not found",
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Catalog product error:", error);
    return res.status(500).json({
      message: "Failed to fetch product",
    });
  }
});

export default router;
