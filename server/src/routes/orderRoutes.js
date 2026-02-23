import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getMyOrder } from "../controllers/orderController.js";

const router = Router();

router.get("/:orderId", requireAuth, getMyOrder);

export default router;