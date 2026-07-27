import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { updateMe, uploadMyAvatar } from "../controllers/userController.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = Router();

function handleAvatarUpload(req, res, next) {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (!err) return next();

    const isFileSizeError = err?.code === "LIMIT_FILE_SIZE";

    return res.status(isFileSizeError ? 413 : 400).json({
      error: isFileSizeError
        ? "Avatar image is too large. Please upload an image under 5MB."
        : err?.message || "Avatar upload failed",
    });
  });
}

router.put("/me", requireAuth, updateMe);
router.post("/me/avatar", requireAuth, handleAvatarUpload, uploadMyAvatar);

export default router;
