import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { createResetToken } from "../utils/resetToken.js";

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";
const isRender = Boolean(process.env.RENDER);

const useSecureCookie = isProduction || isRender;

const authCookieOptions = {
	httpOnly: true,
	secure: useSecureCookie,
	sameSite: useSecureCookie ? "none" : "lax",
	path: "/",
	maxAge: 1000 * 60 * 60 * 24 * 7,
};

function setAuthCookie(res, token) {
	res.cookie("token", token, authCookieOptions);
}

function serializeUser(user) {
	return {
		id: user._id,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		phone: user.phone || "",
		role: user.role,
		authProvider: user.authProvider || "local",

		company: user.company || { name: "" },

		billingAddress: user.billingAddress || {
			address1: "",
			address2: "",
			city: "",
			state: "",
			zip: "",
		},

		deliveryAddress: user.deliveryAddress || {
			address1: "",
			address2: "",
			city: "",
			state: "",
			zip: "",
		},

		tax: user.tax || {
			status: "non_exempt",
			approvedAt: null,
			approvedBy: null,
		},

		avatarUrl: user.avatarUrl || "",
		avatarUpdatedAt: user.avatarUpdatedAt || null,
		account: user.account || {
			requestedType: "RETAIL",
			approvedType: "RETAIL",
			approvalStatus: "NONE",
			rejectionReason: "",
		},

		payment: {
			hasCardOnFile: Boolean(user?.payment?.defaultPaymentMethodId),
		},
	};
}

async function verifyGoogleCredential(credential = "") {
	if (!credential) {
		throw new Error("Missing Google credential");
	}

	const clientId =
		process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
	if (!clientId) {
		throw new Error("Google sign-in is not configured on the server");
	}

	const params = new URLSearchParams({ id_token: credential });
	const response = await fetch(
		`https://oauth2.googleapis.com/tokeninfo?${params.toString()}`,
	);
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(payload?.error_description || "Invalid Google credential");
	}

	if (payload.aud !== clientId) {
		throw new Error("Google credential is for a different client ID");
	}

	if (payload.email_verified !== "true" && payload.email_verified !== true) {
		throw new Error("Google email is not verified");
	}

	if (!payload.email || !payload.sub) {
		throw new Error("Google credential is missing account details");
	}

	return payload;
}

function splitGoogleName(payload = {}) {
	const givenName = String(payload.given_name || "").trim();
	const familyName = String(payload.family_name || "").trim();

	if (givenName || familyName) {
		return {
			firstName: givenName || "Google",
			lastName: familyName || "User",
		};
	}

	const nameParts = String(payload.name || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	return {
		firstName: nameParts[0] || "Google",
		lastName: nameParts.slice(1).join(" ") || "User",
	};
}

router.post("/register", async (req, res) => {
	try {
		const {
			email,
			password,
			firstName,
			lastName,
			companyName = "",
			phone = "",
			billingAddress,
			deliveryAddress,
			adminKey,
		} = req.body;

		if (!email || !password || !firstName || !lastName) {
			return res.status(400).json({ error: "Missing required fields" });
		}

		const existing = await User.findOne({ email: email.toLowerCase() });
		if (existing)
			return res.status(409).json({ error: "Email already in use" });

		const passwordHash = await bcrypt.hash(password, 12);

		const isAdmin =
			typeof adminKey === "string" &&
			adminKey.length > 0 &&
			adminKey === process.env.ADMIN_INVITE_KEY;

		const user = await User.create({
			email: email.toLowerCase(),
			passwordHash,
			firstName,
			lastName,
			phone,
			company: { name: companyName || "" },
			billingAddress: billingAddress || undefined,
			deliveryAddress: deliveryAddress || undefined,
			// tax.status defaults in schema to non_exempt (recommended)
			role: isAdmin ? "admin" : "user",
		});

		const token = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, token);

		return res.status(201).json({ user: serializeUser(user) });
	} catch (err) {
		console.error("REGISTER ERROR:", err);
		res.status(500).json({ error: "Registration failed" });
	}
});

router.post("/google", async (req, res) => {
	try {
		const { credential } = req.body || {};
		const googleProfile = await verifyGoogleCredential(credential);
		const email = String(googleProfile.email || "")
			.toLowerCase()
			.trim();

		let user = await User.findOne({
			$or: [{ email }, { googleId: googleProfile.sub }],
		});

		if (!user) {
			const { firstName, lastName } = splitGoogleName(googleProfile);
			const passwordHash = await bcrypt.hash(
				crypto.randomBytes(32).toString("hex"),
				12,
			);

			user = await User.create({
				email,
				passwordHash,
				firstName,
				lastName,
				authProvider: "google",
				googleId: googleProfile.sub,
				googlePicture: googleProfile.picture || "",
				avatarUrl: googleProfile.picture || "",
				avatarUpdatedAt: googleProfile.picture ? new Date() : null,
			});
		} else {
			let changed = false;

			if (!user.googleId) {
				user.googleId = googleProfile.sub;
				changed = true;
			}

			if (user.authProvider !== "google") {
				user.authProvider = "google";
				changed = true;
			}

			if (googleProfile.picture && !user.googlePicture) {
				user.googlePicture = googleProfile.picture;
				changed = true;
			}

			if (googleProfile.picture && !user.avatarUrl) {
				user.avatarUrl = googleProfile.picture;
				user.avatarUpdatedAt = new Date();
				changed = true;
			}

			if (changed) await user.save();
		}

		const token = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, token);

		return res.status(200).json({ user: serializeUser(user) });
	} catch (err) {
		console.error("GOOGLE LOGIN ERROR:", err);
		return res
			.status(401)
			.json({ error: err.message || "Google sign-in failed" });
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

		return res.status(200).json({ user: serializeUser(user) });
	} catch (err) {
		console.error("LOGIN ERROR:", err);
		res.status(500).json({ error: "Login failed" });
	}
});

router.post("/logout", (_req, res) => {
	res.clearCookie("token", {
		httpOnly: true,
		secure: useSecureCookie,
		sameSite: useSecureCookie ? "none" : "lax",
		path: "/",
	});

	res.status(200).json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
	const user = await User.findById(req.user.id).lean();
	if (!user) return res.status(404).json({ error: "User not found" });

	return res.json({ user: serializeUser(user) });
});

/* ===========================
   Forgot / Reset password
   =========================== */

function getResetClientOrigin(req) {
	const configuredOrigin =
		process.env.CLIENT_ORIGIN ||
		process.env.FRONTEND_URL ||
		process.env.SITE_URL ||
		"";

	if (configuredOrigin) {
		return configuredOrigin.replace(/\/$/, "");
	}

	if (process.env.NODE_ENV !== "production") {
		return "http://localhost:5173";
	}

	return `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
}

function getMailCredentials() {
	return {
		user: process.env.GMAIL_USER || process.env.EMAIL_USER || "",
		pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "",
	};
}

async function sendPasswordResetEmail({ to, resetLink }) {
	const { user, pass } = getMailCredentials();

	if (!user || !pass) {
		console.warn(
			"PASSWORD RESET EMAIL NOT SENT: missing GMAIL_USER/GMAIL_APP_PASSWORD or EMAIL_USER/EMAIL_PASS.",
		);
		console.warn("Development reset link:", resetLink);
		return { skipped: true };
	}

	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: { user, pass },
	});

	return transporter.sendMail({
		from: `"Industrial Hardware Idaho" <${user}>`,
		to,
		subject: "Reset your Industrial Hardware Idaho password",
		html: `
			<div style="font-family:Arial,sans-serif;line-height:1.5;color:#183018;">
				<h2 style="margin:0 0 12px;">Reset your password</h2>
				<p>Click the button below to reset your password.</p>
				<p>
					<a href="${resetLink}" style="display:inline-block;padding:10px 14px;background:#495a42;color:#fff;text-decoration:none;border-radius:10px;">
						Reset Password
					</a>
				</p>
				<p>This link expires in 1 hour.</p>
				<p>If you didn’t request this, you can ignore this email.</p>
				<p style="font-size:12px;color:#666;">If the button does not work, copy and paste this link into your browser:<br/>${resetLink}</p>
			</div>
		`,
	});
}

router.post("/forgot-password", async (req, res) => {
	try {
		const { email } = req.body || {};
		const normalizedEmail = String(email || "")
			.toLowerCase()
			.trim();

		if (!normalizedEmail) {
			return res.status(400).json({ error: "Email is required" });
		}

		const user = await User.findOne({ email: normalizedEmail });

		// Always return success to avoid leaking whether an account exists.
		if (!user) return res.json({ success: true });

		const { token, tokenHash } = createResetToken();
		user.resetPasswordTokenHash = tokenHash;
		user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
		await user.save();

		const origin = getResetClientOrigin(req);
		const resetLink = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(
			user.email,
		)}`;

		await sendPasswordResetEmail({ to: user.email, resetLink });

		return res.json({ success: true });
	} catch (err) {
		console.error("FORGOT PASSWORD ERROR:", err);

		// Keep response generic so the endpoint does not reveal account existence.
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
			return res
				.status(400)
				.json({ error: "Password must be at least 8 characters" });
		}

		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

		const user = await User.findOne({
			email: email.toLowerCase(),
			resetPasswordTokenHash: tokenHash,
			resetPasswordExpiresAt: { $gt: new Date() },
		});

		if (!user) {
			return res.status(400).json({ error: "Invalid or expired reset link" });
		}

		user.passwordHash = await bcrypt.hash(newPassword, 12);

		// Invalidate token
		user.resetPasswordTokenHash = "";
		user.resetPasswordExpiresAt = null;

		await user.save();

		// Optional: auto-login after reset
		const jwtToken = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, jwtToken);

		return res.json({ success: true, user: serializeUser(user) });
	} catch (err) {
		console.error("RESET PASSWORD ERROR:", err);
		return res.status(500).json({ error: "Reset failed" });
	}
});

export default router;
