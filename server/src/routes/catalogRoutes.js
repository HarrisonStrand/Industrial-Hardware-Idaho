import express from "express";
import getPublishedCatalog from "../services/catalog/getPublishedCatalog.js";
import getPublishedProductBySlug from "../services/catalog/getPublishedProductBySlug.js";

const router = express.Router();

// GET /api/catalog
router.get("/", async (req, res) => {
  try {
    const { category, subcategory, search, limit, skip } = req.query;

    const result = await getPublishedCatalog({
      category,
      subcategory,
      search,
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