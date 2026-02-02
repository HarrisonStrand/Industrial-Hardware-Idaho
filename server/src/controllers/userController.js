import crypto from "crypto";
import User from "../models/User.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL } from "../utils/s3.js";

/**
 * Keep a single “public user” serializer so every route returns the same shape
 * (prevents UI bugs where some pages don't get fields they expect).
 */
function toPublicUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || "",
    role: user.role,

    company: user.company || { name: "" },

    billingAddress: user.billingAddress || {},
    deliveryAddress: user.deliveryAddress || {},

    tax: user.tax || { status: "non_exempt", approvedAt: null, approvedBy: null },

    payment: user.payment || { stripeCustomerId: "", defaultPaymentMethodId: "" },

    avatarUrl: user.avatarUrl || "",
    avatarUpdatedAt: user.avatarUpdatedAt || null,

    notes: user.notes || ""
  };
}

export async function updateMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // -----------------------------
    // Basic fields
    // -----------------------------
    if (typeof req.body.firstName === "string") user.firstName = req.body.firstName.trim();
    if (typeof req.body.lastName === "string") user.lastName = req.body.lastName.trim();
    if (typeof req.body.phone === "string") user.phone = req.body.phone.trim();

    // Notes: allow user to store personal notes (optional)
    if (typeof req.body.notes === "string") user.notes = req.body.notes;

    // -----------------------------
    // Company name
    // Accept either:
    //  - company: { name: "..." }
    //  - companyName: "..."
    // -----------------------------
    if (req.body.company && typeof req.body.company === "object") {
      if (typeof req.body.company.name === "string") {
        user.company = { ...(user.company?.toObject?.() || user.company || {}), name: req.body.company.name.trim() };
      }
    } else if (typeof req.body.companyName === "string") {
      user.company = { ...(user.company?.toObject?.() || user.company || {}), name: req.body.companyName.trim() };
    }

    // -----------------------------
    // Email (login email) — allow change, but enforce uniqueness
    // -----------------------------
    if (typeof req.body.email === "string") {
      const nextEmail = req.body.email.toLowerCase().trim();
      if (nextEmail && nextEmail !== user.email) {
        const existing = await User.findOne({ email: nextEmail }).lean();
        if (existing) return res.status(409).json({ error: "Email already in use" });
        user.email = nextEmail;
      }
    }

    // -----------------------------
    // Addresses
    // -----------------------------
    // You can send:
    // billingAddress: { address1, address2, city, state, zip }
    // deliveryAddress: { address1, address2, city, state, zip }
    const normalizeAddress = (addr) => {
      if (!addr || typeof addr !== "object") return null;
      return {
        name: typeof addr.name === "string" ? addr.name.trim() : (user.billingAddress?.name || ""),
        address1: typeof addr.address1 === "string" ? addr.address1.trim() : (addr.address1 ?? ""),
        address2: typeof addr.address2 === "string" ? addr.address2.trim() : (addr.address2 ?? ""),
        city: typeof addr.city === "string" ? addr.city.trim() : (addr.city ?? ""),
        state: typeof addr.state === "string" ? addr.state.trim() : (addr.state ?? ""),
        zip: typeof addr.zip === "string" ? addr.zip.trim() : (addr.zip ?? "")
      };
    };

    const nextBilling = normalizeAddress(req.body.billingAddress);
    if (nextBilling) {
      user.billingAddress = {
        ...(user.billingAddress?.toObject?.() || user.billingAddress || {}),
        ...nextBilling
      };
    }

    const nextDelivery = normalizeAddress(req.body.deliveryAddress);
    if (nextDelivery) {
      user.deliveryAddress = {
        ...(user.deliveryAddress?.toObject?.() || user.deliveryAddress || {}),
        ...nextDelivery
      };
    }

    // -----------------------------
    // Tax status — user can only request exempt (goes to pending)
    // Admin approval is handled elsewhere.
    // -----------------------------
    if (req.body.requestTaxExempt === true) {
      const current = user.tax?.status || "non_exempt";
      if (current === "non_exempt") {
        user.tax = {
          ...(user.tax?.toObject?.() || user.tax || {}),
          status: "pending",
          approvedAt: null,
          approvedBy: null
        };
      }
      // If already pending/exempt, do nothing (idempotent)
    }

    await user.save();

    return res.json({ user: toPublicUser(user) });
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
        // Do NOT set ACL unless your bucket supports ACLs.
        // ACL: "public-read",
      })
    );

    const avatarUrl = `${S3_PUBLIC_BASE_URL}/${key}`;

    user.avatarKey = key;
    user.avatarUrl = avatarUrl;
    user.avatarUpdatedAt = new Date();
    await user.save();

    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("AVATAR UPLOAD ERROR:", err);
    return res.status(500).json({ error: "Failed to upload avatar" });
  }
}
