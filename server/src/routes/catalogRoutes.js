import express from "express";
import getPublishedCatalog from "../services/catalog/getPublishedCatalog.js";
import getPublishedProductBySlug from "../services/catalog/getPublishedProductBySlug.js";

const router = express.Router();

// GET /api/catalog
router.get("/", async (req, res) => {
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

    const result = await getPublishedCatalog({
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
