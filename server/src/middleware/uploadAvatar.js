import multer from "multer";

const MAX_AVATAR_SIZE_MB = 5;

const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedAvatarMimeTypes.has(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG, WEBP, and GIF avatar images are allowed")
      );
    }

    cb(null, true);
  }
});

export default uploadAvatar;
