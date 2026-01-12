import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

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
			role: isAdmin ? "admin" : "customer",
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

export default router;
