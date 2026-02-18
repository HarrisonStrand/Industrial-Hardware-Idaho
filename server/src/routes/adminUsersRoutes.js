import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  listUsers,
  updateAccountApproval,
} from "../controllers/adminUsersController.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, listUsers);
router.patch("/:id/account-approval", requireAuth, requireAdmin, updateAccountApproval);

export default router;
