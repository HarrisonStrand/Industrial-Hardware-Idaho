import { Router } from "express";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";

import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// PUBLIC ROUTES
router.get("/", listProducts);
router.get("/:id", getProduct);

// ADMIN ROUTES
router.post("/", requireAuth, requireAdmin, createProduct);
router.put("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export default router;
