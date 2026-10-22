import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import requireCheckoutEnabled from "../middleware/requireCheckoutEnabled.js";
import {
  getCapabilities,
  requestAccountType,
  createPayLaterOrder,
  createPayNowIntent,
  payNowWithSavedCard
} from "../controllers/checkoutController.js";

const router = Router();

router.get("/capabilities", requireAuth, getCapabilities);
router.post("/request-account-type", requireAuth, requestAccountType);
router.post("/pay-later/order", requireAuth, requireCheckoutEnabled, createPayLaterOrder);

// ✅ Pay now
router.post("/pay-now/intent", requireAuth, requireCheckoutEnabled, createPayNowIntent);
router.post("/pay-now/saved-card", requireAuth, requireCheckoutEnabled, payNowWithSavedCard);

export default router;