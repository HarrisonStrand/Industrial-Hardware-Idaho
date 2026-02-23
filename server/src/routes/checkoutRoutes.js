import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCapabilities,
  requestAccountType,
  createPayLaterOrder,
  createPayNowIntent,
  chargeSavedCardPayNow
} from "../controllers/checkoutController.js";

const router = Router();

router.get("/capabilities", requireAuth, getCapabilities);
router.post("/request-account-type", requireAuth, requestAccountType);
router.post("/pay-later/order", requireAuth, createPayLaterOrder);

// ✅ Pay now
router.post("/pay-now/intent", requireAuth, createPayNowIntent);
router.post("/pay-now/saved-card", requireAuth, chargeSavedCardPayNow);

export default router;