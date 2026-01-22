import express from "express";
import nodemailer from "nodemailer";

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
      date
    } = req.body || {};

    if (!partName || !partDescription || !quantityNeeded || !name || !phone || !email) {
      return res.status(400).send("Missing required fields");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const subject = `Special Request: ${partName} (${quantityNeeded})`;

    const html = `
      <h2>Special Request</h2>
      <p><strong>Date:</strong> ${date || ""}</p>
      <hr/>
      <p><strong>Part Name:</strong> ${partName}</p>
      <p><strong>Quantity Needed:</strong> ${quantityNeeded}</p>
      <p><strong>Customer PO:</strong> ${customerPO || "N/A"}</p>
      <p><strong>Description:</strong><br/>${String(partDescription).replace(/\n/g, "<br/>")}</p>
      <hr/>
      <p><strong>Customer Name/Title:</strong> ${name}</p>
      <p><strong>Company:</strong> ${company || "N/A"}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.SUPPORT_INBOX || process.env.GMAIL_USER,
      replyTo: email,
      subject,
      html
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("SPECIAL REQUEST ERROR:", err);
    return res.status(500).send("Failed to send request");
  }
});

export default router;
