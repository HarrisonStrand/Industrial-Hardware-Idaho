import express from "express";
import { sendNewsletterSignupEmail } from "../utils/mailer.js";

const router = express.Router();

function isValidEmail(value = "") {
  return /^\S+@\S+\.\S+$/.test(String(value || "").trim());
}

router.post("/", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const source = String(req.body?.source || "website").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    await sendNewsletterSignupEmail({ email, source });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("NEWSLETTER SIGNUP ERROR:", err);
    return res.status(500).json({ error: "Failed to submit newsletter signup." });
  }
});

export default router;
