import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { createResetToken } from "../utils/resetToken.js";


const router = express.Router();

function setAuthCookie(res, token) {
	const isProd = process.env.NODE_ENV === "production";

	res.cookie("token", token, {
		httpOnly: true,
		secure: isProd, // must be true on HTTPS
		sameSite: isProd ? "none" : "lax",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});
}

router.post("/register", async (req, res) => {
	try {
		const {
			email,
			password,
			firstName,
			lastName,
			company = {},
			adminKey, // ✅ optional
		} = req.body;

		if (!email || !password || !firstName || !lastName) {
			return res.status(400).json({ error: "Missing required fields" });
		}

		const existing = await User.findOne({ email: email.toLowerCase() });
		if (existing)
			return res.status(409).json({ error: "Email already in use" });

		const passwordHash = await bcrypt.hash(password, 12);

		// ✅ Enforce role safely (no client-controlled role)
		const isAdmin =
			typeof adminKey === "string" &&
			adminKey.length > 0 &&
			adminKey === process.env.ADMIN_INVITE_KEY;

		const user = await User.create({
			email: email.toLowerCase(),
			passwordHash,
			firstName,
			lastName,
			company,
			role: isAdmin ? "admin" : "user",
		});

		const token = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, token);

		return res.status(201).json({
			user: {
				id: user._id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
				company: user.company,
				avatarUrl: user.avatarUrl || "",
				avatarUpdatedAt: user.avatarUpdatedAt || null,
			},
		});
	} catch (err) {
		console.error("REGISTER ERROR:", err);
		res.status(500).json({ error: "Registration failed" });
	}
});

router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: "Missing email or password" });
		}

		const user = await User.findOne({ email: email.toLowerCase() });
		if (!user) return res.status(401).json({ error: "Invalid credentials" });

		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return res.status(401).json({ error: "Invalid credentials" });

		const token = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, token);

		return res.status(200).json({
			user: {
				id: user._id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				role: user.role,
				company: user.company,
				avatarUrl: user.avatarUrl || "",
				avatarUpdatedAt: user.avatarUpdatedAt || null,
			},
		});
	} catch (err) {
		console.error("LOGIN ERROR:", err);
		res.status(500).json({ error: "Login failed" });
	}
});

router.post("/logout", (_req, res) => {
	res.clearCookie("token");
	res.status(200).json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
	const user = await User.findById(req.user.id).lean();
	if (!user) return res.status(404).json({ error: "User not found" });

	res.json({
		user: {
			id: user._id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role,
			company: user.company,
			avatarUrl: user.avatarUrl || "",
			avatarUpdatedAt: user.avatarUpdatedAt || null,
		},
	});
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });

    // ✅ Always return success to avoid leaking whether the account exists
    if (!user) return res.json({ success: true });

    const { token, tokenHash } = createResetToken();
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    const resetLink = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(
      user.email
    )}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: "Reset your password",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Reset your password</h2>
          <p>Click the button below to reset your password.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
              Reset Password
            </a>
          </p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn’t request this, you can ignore this email.</p>
        </div>
      `
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.json({ success: true });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);

    // ✅ Invalidate token
    user.resetPasswordTokenHash = "";
    user.resetPasswordExpiresAt = null;

    await user.save();

    // ✅ Optional: auto-login after reset
    const jwtToken = signToken({ id: user._id.toString(), role: user.role });
    setAuthCookie(res, jwtToken);

    return res.json({
      success: true,
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
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ error: "Reset failed" });
  }
});


export default router;
