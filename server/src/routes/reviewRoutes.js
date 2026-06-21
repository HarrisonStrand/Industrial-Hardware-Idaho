import { Router } from "express";
import {
  getHomeReviews,
  getGoogleReviewsPublic,
  createWebsiteReview,
  getAdminReviewSummary,
  listAdminReviews,
  getAdminReviewDetail,
  approveAdminReview,
  rejectAdminReview,
  toggleFeaturedAdminReview,
  getAdminGoogleReviews,
  syncAdminGoogleReviews,
} from "../controllers/reviewController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/home", getHomeReviews);
router.get("/google", getGoogleReviewsPublic);
router.post("/", createWebsiteReview);

router.get("/admin/google", requireAuth, requireAdmin, getAdminGoogleReviews);
router.post("/admin/google/sync", requireAuth, requireAdmin, syncAdminGoogleReviews);
router.get("/admin/summary", requireAuth, requireAdmin, getAdminReviewSummary);
router.get("/admin", requireAuth, requireAdmin, listAdminReviews);
router.get("/admin/:id", requireAuth, requireAdmin, getAdminReviewDetail);
router.post("/admin/:id/approve", requireAuth, requireAdmin, approveAdminReview);
router.post("/admin/:id/reject", requireAuth, requireAdmin, rejectAdminReview);
router.post("/admin/:id/toggle-featured", requireAuth, requireAdmin, toggleFeaturedAdminReview);

export default router;