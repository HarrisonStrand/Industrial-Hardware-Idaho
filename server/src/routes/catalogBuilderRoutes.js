import express from "express";
import User from "../models/User.js";
import { optionalAuth } from "../middleware/auth.js";
import getCatalogBuilderSubcategory from "../services/catalog/getCatalogBuilderSubcategory.js";
import { buildPricingContextFromUser } from "../utils/resolveProductPrice.js";

const router = express.Router();

router.get("/:categoryId/:subcategoryId", optionalAuth, async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

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
      { pricingContext }
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