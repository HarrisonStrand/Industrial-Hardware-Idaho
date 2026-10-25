import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
	transporter,
	fromHeader,
	FROM_ADDRESS,
	mailConfigured,
	sendVerificationCodeEmail,
	sendPasswordChangedEmail,
	sendAccountDeletedEmail,
} from "../utils/mailer.js";
import { deleteUserAccount } from "../utils/deleteAccount.js";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { createResetToken } from "../utils/resetToken.js";
import {
	isEmailVerified,
	issueVerificationCode,
	canResendCode,
	checkVerificationCode,
	markEmailVerified,
} from "../utils/emailVerification.js";

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;

// Makes a new code, saves it on the user and emails it. Returns false if the
// email could not be sent (the person can ask for a new code).
async function sendNewVerificationCode(user) {
	const code = issueVerificationCode(user);
	await user.save();

	if (!mailConfigured()) {
		// Same as password reset: with no mail settings (local testing), show the code in the server log.
		console.warn("VERIFICATION EMAIL NOT SENT: mail settings are missing.");
		console.warn(`Development verification code for ${user.email}: ${code}`);
		return false;
	}

	try {
		await sendVerificationCodeEmail({ to: user.email, code, firstName: user.firstName });
		return true;
	} catch (err) {
		console.error("VERIFICATION EMAIL ERROR:", err?.message || err);
		return false;
	}
}

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

	const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
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

		if (String(password).length < MIN_PASSWORD_LENGTH) {
			return res
				.status(400)
				.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
		}

		const normalizedEmail = email.toLowerCase().trim();
		const existing = await User.findOne({ email: normalizedEmail });
		if (existing && isEmailVerified(existing))
			return res.status(409).json({ error: "Email already in use" });

		const passwordHash = await bcrypt.hash(password, 12);

		const isAdmin =
			typeof adminKey === "string" &&
			adminKey.length > 0 &&
			adminKey === process.env.ADMIN_INVITE_KEY;

		const fields = {
			passwordHash,
			firstName,
			lastName,
			phone,
			company: { name: companyName || "" },
			billingAddress: billingAddress || undefined,
			deliveryAddress: deliveryAddress || undefined,
			// tax.status defaults in schema to non_exempt (recommended)
			role: isAdmin ? "admin" : "user",
			emailVerified: false,
		};

		// A sign-up that never entered its code is replaced by the new one.
		let user;
		if (existing) {
			existing.set(fields);
			user = existing;
		} else {
			user = new User({ email: normalizedEmail, ...fields });
		}

		// No sign-in until the emailed code is entered.
		const emailSent = await sendNewVerificationCode(user);

		return res.status(201).json({ verificationRequired: true, email: user.email, emailSent });
	} catch (err) {
		console.error("REGISTER ERROR:", err);
		res.status(500).json({ error: "Registration failed" });
	}
});


router.post("/google", async (req, res) => {
	try {
		const { credential } = req.body || {};
		const googleProfile = await verifyGoogleCredential(credential);
		const email = String(googleProfile.email || "").toLowerCase().trim();

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

			// Google has checked this email. A sign-up still waiting for its code
			// becomes verified, and its unconfirmed password is replaced.
			if (!isEmailVerified(user)) {
				user.passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
				markEmailVerified(user);
				changed = true;
			}

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
		return res.status(401).json({ error: err.message || "Google sign-in failed" });
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

		if (!isEmailVerified(user)) {
			// Send a fresh code unless one went out in the last minute.
			if (canResendCode(user)) await sendNewVerificationCode(user);
			return res.status(403).json({
				error: "Verify your email to finish creating your account. We emailed you a 6-digit code.",
				code: "EMAIL_NOT_VERIFIED",
				email: user.email,
			});
		}

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
   Email verification (6-digit code)
   =========================== */

// Body: { email, code }. On success the account is verified and signed in.
router.post("/verify-email", async (req, res) => {
	try {
		const email = String(req.body?.email || "").toLowerCase().trim();
		const code = String(req.body?.code || "").replace(/\D/g, "");
		if (!email || code.length !== 6) {
			return res.status(400).json({ error: "Enter the 6-digit code from your email." });
		}

		const user = await User.findOne({ email });
		if (!user) return res.status(400).json({ error: "That code is not valid. Request a new one." });

		if (isEmailVerified(user)) {
			return res.status(400).json({ error: "This email is already verified. Sign in instead.", code: "ALREADY_VERIFIED" });
		}

		const result = checkVerificationCode(user, code);
		if (result !== "ok") {
			await user.save();
			const messages = {
				expired: "That code has expired. Request a new one.",
				too_many: "Too many tries. Request a new code.",
				wrong: "That code is not right. Check the email and try again.",
			};
			return res.status(400).json({ error: messages[result], code: result.toUpperCase() });
		}

		markEmailVerified(user);
		await user.save();

		const token = signToken({ id: user._id.toString(), role: user.role });
		setAuthCookie(res, token);

		return res.json({ success: true, user: serializeUser(user) });
	} catch (err) {
		console.error("VERIFY EMAIL ERROR:", err);
		return res.status(500).json({ error: "Verification failed. Please try again." });
	}
});

// Body: { email }. Always answers the same way so it never reveals which emails have accounts.
router.post("/resend-verification", async (req, res) => {
	try {
		const email = String(req.body?.email || "").toLowerCase().trim();
		const user = email ? await User.findOne({ email }) : null;

		if (user && !isEmailVerified(user)) {
			if (!canResendCode(user)) {
				return res.status(429).json({ error: "Please wait a minute before asking for another code." });
			}
			await sendNewVerificationCode(user);
		}

		return res.json({ success: true });
	} catch (err) {
		console.error("RESEND VERIFICATION ERROR:", err);
		return res.json({ success: true });
	}
});

/* ===========================
   Change password (signed in)
   =========================== */

// Body: { currentPassword, newPassword }.
router.post("/change-password", requireAuth, async (req, res) => {
	try {
		const { currentPassword = "", newPassword = "" } = req.body || {};
		if (!currentPassword || !newPassword) {
			return res.status(400).json({ error: "Enter your current password and a new password." });
		}
		if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
			return res
				.status(400)
				.json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
		}
		if (currentPassword === newPassword) {
			return res.status(400).json({ error: "The new password must be different from the current one." });
		}

		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ error: "User not found" });

		const ok = await bcrypt.compare(currentPassword, user.passwordHash);
		if (!ok) return res.status(400).json({ error: "Current password is not correct." });

		user.passwordHash = await bcrypt.hash(newPassword, 12);
		await user.save();

		if (mailConfigured()) {
			await sendPasswordChangedEmail({ to: user.email, firstName: user.firstName }).catch((err) =>
				console.error("PASSWORD CHANGED EMAIL ERROR:", err?.message || err),
			);
		}

		return res.json({ success: true });
	} catch (err) {
		console.error("CHANGE PASSWORD ERROR:", err);
		return res.status(500).json({ error: "Could not change the password. Please try again." });
	}
});

/* ===========================
   Delete account (signed in, customers only)
   =========================== */

const ADMIN_DELETE_MESSAGE =
	"Admin accounts can't be deleted here. Ask another admin to remove the account.";

// Accounts that sign in with Google may not know a password, so they confirm
// with a 6-digit code emailed to them (it uses the same code slot as sign-up).
router.post("/delete-account/send-code", requireAuth, async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ error: "User not found" });
		if (user.role === "admin") return res.status(403).json({ error: ADMIN_DELETE_MESSAGE });
		if (!canResendCode(user)) {
			return res.status(429).json({ error: "Please wait a minute before asking for another code." });
		}

		const code = issueVerificationCode(user);
		await user.save();

		if (!mailConfigured()) {
			console.warn("DELETE CODE EMAIL NOT SENT: mail settings are missing.");
			console.warn(`Development delete code for ${user.email}: ${code}`);
		} else {
			await sendVerificationCodeEmail({ to: user.email, code, firstName: user.firstName, purpose: "delete" });
		}

		return res.json({ success: true });
	} catch (err) {
		console.error("DELETE CODE ERROR:", err);
		return res.status(500).json({ error: "Could not send the code. Please try again." });
	}
});

// Body: { confirm: "DELETE", password } or { confirm: "DELETE", code }.
router.post("/delete-account", requireAuth, async (req, res) => {
	try {
		const { confirm = "", password = "", code = "" } = req.body || {};
		if (String(confirm).trim() !== "DELETE") {
			return res.status(400).json({ error: "Type DELETE to confirm." });
		}

		const user = await User.findById(req.user.id);
		if (!user) return res.status(404).json({ error: "User not found" });
		if (user.role === "admin") return res.status(403).json({ error: ADMIN_DELETE_MESSAGE });

		if (password) {
			const ok = await bcrypt.compare(password, user.passwordHash);
			if (!ok) return res.status(400).json({ error: "Password is not correct." });
		} else if (code) {
			const result = checkVerificationCode(user, String(code).replace(/\D/g, ""));
			if (result !== "ok") {
				await user.save();
				const messages = {
					expired: "That code has expired. Send a new one.",
					too_many: "Too many tries. Send a new code.",
					wrong: "That code is not right.",
				};
				return res.status(400).json({ error: messages[result] });
			}
		} else {
			return res.status(400).json({ error: "Enter your password, or the code we emailed you." });
		}

		const { email, firstName } = user;
		const problems = await deleteUserAccount(user);
		console.log(`ACCOUNT DELETED by its owner: ${user._id}${problems.length ? ` (cleanup issues: ${problems.join("; ")})` : ""}`);

		res.clearCookie("token", {
			httpOnly: true,
			secure: useSecureCookie,
			sameSite: useSecureCookie ? "none" : "lax",
			path: "/",
		});

		if (mailConfigured()) {
			await sendAccountDeletedEmail({ to: email, firstName }).catch((err) =>
				console.error("ACCOUNT DELETED EMAIL ERROR:", err?.message || err),
			);
		}

		return res.json({ success: true });
	} catch (err) {
		console.error("DELETE ACCOUNT ERROR:", err);
		return res.status(500).json({ error: "Could not delete the account. Please try again." });
	}
});

/* ===========================
   Forgot / Reset password
   =========================== */


function getResetClientOrigin(req) {
  // A single URL used for password-reset links.
  // Keep this separate from the comma-separated CORS origins.
  const configuredOrigin =
    process.env.FRONTEND_URL ||
    process.env.SITE_URL ||
    (process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)[0] ||
    "";

  if (configuredOrigin) {
    return configuredOrigin.trim().replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }

  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
}


// Sent through the same mail settings as every other site email (utils/mailer.js).
async function sendPasswordResetEmail({ to, resetLink }) {
	if (!FROM_ADDRESS) {
		console.warn("PASSWORD RESET EMAIL NOT SENT: mail settings are missing.");
		console.warn("Development reset link:", resetLink);
		return { skipped: true };
	}

	return transporter.sendMail({
		from: fromHeader("Industrial Hardware Idaho"),
		replyTo: process.env.EMAIL_TO || FROM_ADDRESS,
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
		const normalizedEmail = String(email || "").toLowerCase().trim();

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

		// The reset link was emailed, so the address is proven.
		if (!isEmailVerified(user)) markEmailVerified(user);

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
