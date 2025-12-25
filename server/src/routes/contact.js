import express from "express";
import { sendContactEmail } from "../utils/mailer.js";

const router = express.Router();

router.post("/", async (req, res) => {
	  console.log("📩 CONTACT FORM HIT:", req.body);

  try {
    const {
      name,
      company,
      email,
      phone,
      date,
      subject,
      message
    } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await sendContactEmail({
      name,
      company,
      email,
      phone,
      date,
      subject,
      message
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("CONTACT FORM ERROR:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
