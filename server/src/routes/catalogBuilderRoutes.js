import express from "express";
import getCatalogBuilderSubcategory from "../services/catalog/getCatalogBuilderSubcategory.js";

const router = express.Router();

router.get("/:categoryId/:subcategoryId", async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

    const result = await getCatalogBuilderSubcategory(
      categoryId,
      subcategoryId
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