import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { updateMe, uploadMyAvatar } from "../controllers/userController.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = Router();

router.put("/me", requireAuth, updateMe);
router.post("/me/avatar", requireAuth, uploadAvatar.single("avatar"), uploadMyAvatar);

export default router;
