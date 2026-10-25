import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  listUsers,
  updateAccountApproval,
  updatePriceMultiplier,
  updateTaxStatus,
} from "../controllers/adminUsersController.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, listUsers);
router.patch("/:id/account-approval", requireAuth, requireAdmin, updateAccountApproval);
router.patch("/:id/price-multiplier", requireAuth, requireAdmin, updatePriceMultiplier);
router.patch("/:id/tax-status", requireAuth, requireAdmin, updateTaxStatus);

export default router;
