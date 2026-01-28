import crypto from "crypto";
import User from "../models/User.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET, S3_PUBLIC_BASE_URL } from "../utils/s3.js";

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || "",
    role: user.role,

    company: user.company || { name: "" },

    billingAddress: user.billingAddress || {
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: ""
    },

    deliveryAddress: user.deliveryAddress || {
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: ""
    },

    tax: user.tax || { status: "non_exempt", approvedAt: null, approvedBy: null },

    avatarUrl: user.avatarUrl || "",
    avatarUpdatedAt: user.avatarUpdatedAt || null,

    // Do NOT return card data; only a boolean flag
    payment: {
      hasCardOnFile: Boolean(user?.payment?.defaultPaymentMethodId)
    }
  };
}

export async function updateMe(req, res) {
  try {
    const body = req.body || {};

    const update = {};

    // Basic identity fields
    if (typeof body.firstName === "string") update.firstName = body.firstName;
    if (typeof body.lastName === "string") update.lastName = body.lastName;

    // Company name stored as company.name
    if (typeof body.companyName === "string") update["company.name"] = body.companyName;

    // Phone
    if (typeof body.phone === "string") update.phone = body.phone;

    // Email (allowed, but must remain unique)
    if (typeof body.email === "string" && body.email.trim()) {
      update.email = body.email.trim().toLowerCase();
    }

    // Addresses
    if (body.billingAddress && typeof body.billingAddress === "object") {
      update.billingAddress = {
        address1: body.billingAddress.address1 || "",
        address2: body.billingAddress.address2 || "",
        city: body.billingAddress.city || "",
        state: body.billingAddress.state || "",
        zip: body.billingAddress.zip || ""
      };
    }

    if (body.deliveryAddress && typeof body.deliveryAddress === "object") {
      update.deliveryAddress = {
        address1: body.deliveryAddress.address1 || "",
        address2: body.deliveryAddress.address2 || "",
        city: body.deliveryAddress.city || "",
        state: body.deliveryAddress.state || "",
        zip: body.deliveryAddress.zip || ""
      };
    }

    // Tax exempt request (customer can request; admin approves later)
    // Only move non_exempt -> pending (don’t allow customer to set exempt)
    if (body.requestTaxExempt === true) {
      const existing = await User.findById(req.user.id).lean();
      const currentStatus = existing?.tax?.status || "non_exempt";
      if (currentStatus !== "exempt") {
        update["tax.status"] = "pending";
        update["tax.approvedAt"] = null;
        update["tax.approvedBy"] = null;
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true
    }).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ user: serializeUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error("UPDATE ME ERROR:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function uploadMyAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // delete old avatar from S3 if it exists
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

    const ext = req.file.mimetype.split("/")[1] || "jpg";
    const nonce = crypto.randomBytes(8).toString("hex");
    const key = `avatars/${user._id}-${Date.now()}-${nonce}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      })
    );

    const avatarUrl = `${S3_PUBLIC_BASE_URL}/${key}`;

    user.avatarKey = key;
    user.avatarUrl = avatarUrl;
    user.avatarUpdatedAt = new Date();
    await user.save();

    const fresh = await User.findById(user._id).lean();
    return res.json({ user: serializeUser(fresh) });
  } catch (err) {
    console.error("AVATAR UPLOAD ERROR:", err);
    return res.status(500).json({ error: "Failed to upload avatar" });
  }
}
