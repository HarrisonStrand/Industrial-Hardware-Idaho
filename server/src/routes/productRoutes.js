// server/src/routes/productRoutes.js
import { Router } from "express";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminReviewSummary,
  listAdminReviewProducts,
  getAdminProductDetail,
  patchAdminProduct,
  approveAdminProduct,
  publishAdminProduct,
  unpublishAdminProduct,
  recomputeAdminProduct,
  bulkAdminProducts,
} from "../controllers/productController.js";

import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/admin/review-summary", requireAuth, requireAdmin, getAdminReviewSummary);
router.get("/admin/review", requireAuth, requireAdmin, listAdminReviewProducts);
router.get("/admin/:id", requireAuth, requireAdmin, getAdminProductDetail);
router.patch("/admin/:id", requireAuth, requireAdmin, patchAdminProduct);
router.post("/admin/:id/approve", requireAuth, requireAdmin, approveAdminProduct);
router.post("/admin/:id/publish", requireAuth, requireAdmin, publishAdminProduct);
router.post("/admin/:id/unpublish", requireAuth, requireAdmin, unpublishAdminProduct);
router.post("/admin/:id/recompute", requireAuth, requireAdmin, recomputeAdminProduct);
router.post("/admin/bulk-action", requireAuth, requireAdmin, bulkAdminProducts);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireAuth, requireAdmin, createProduct);
router.put("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export default router;