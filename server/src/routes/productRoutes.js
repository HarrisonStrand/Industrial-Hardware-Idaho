import { Router } from "express";
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from "../controllers/productController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

// public list & detail
router.get("/", listProducts);
router.get("/:id", getProduct);

// admin CRUD
router.post("/", requireAuth, requireRole("admin"), createProduct);
router.put("/:id", requireAuth, requireRole("admin"), updateProduct);
router.delete("/:id", requireAuth, requireRole("admin"), deleteProduct);

export default router;
