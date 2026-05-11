import express from "express";
import { sendSpecialRequestEmail } from "../utils/mailer.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      partName,
      partDescription,
      quantityNeeded,
      customerPO,
      name,
      company,
      phone,
      email,
      date,
    } = req.body || {};

    if (!partName || !partDescription || !quantityNeeded || !name || !phone || !email) {
      return res.status(400).send("Missing required fields");
    }

    await sendSpecialRequestEmail({
      partName,
      partDescription,
      quantityNeeded,
      customerPO,
      name,
      company,
      phone,
      email,
      date,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("SPECIAL REQUEST ERROR:", err);
    return res.status(500).send("Failed to send request");
  }
});

export default router;
