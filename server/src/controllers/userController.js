import crypto from "crypto";
import User from "../models/User.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL } from "../utils/s3.js";

export async function updateMe(req, res) {
  try {
    const allowed = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      company: req.body.company
    };

    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

    const user = await User.findByIdAndUpdate(req.user.id, allowed, { new: true }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        avatarUrl: user.avatarUrl || "",
        avatarUpdatedAt: user.avatarUpdatedAt || null
      }
    });
  } catch (err) {
    console.error("UPDATE ME ERROR:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function uploadMyAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Optional: delete old avatar from S3 if it exists
    if (user.avatarKey) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: user.avatarKey
          })
        );
      } catch (e) {
        console.warn("Could not delete old avatar (continuing):", e?.message || e);
      }
    }

    // Create a unique key
    const ext = req.file.mimetype.split("/")[1] || "jpg";
    const nonce = crypto.randomBytes(8).toString("hex");
    const key = `avatars/${user._id}-${Date.now()}-${nonce}.${ext}`;

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype

        // DO NOT set ACL unless you know your bucket supports it.
        // If your bucket allows ACLs, you can uncomment this:
        // ACL: "public-read",
      })
    );

    const avatarUrl = `${S3_PUBLIC_BASE_URL}/${key}`;

    user.avatarKey = key;
    user.avatarUrl = avatarUrl;
    user.avatarUpdatedAt = new Date();
    await user.save();

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        avatarUrl: user.avatarUrl,
        avatarUpdatedAt: user.avatarUpdatedAt
      }
    });
  } catch (err) {
    console.error("AVATAR UPLOAD ERROR:", err);
    return res.status(500).json({ error: "Failed to upload avatar" });
  }
}
