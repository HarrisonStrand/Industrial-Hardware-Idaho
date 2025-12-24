const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

// --------------------------------------------------
// POST /api/contact
// --------------------------------------------------
router.post("/", async (req, res) => {
  const {
    contactName,
    companyName,
    phone,
    email,
    subject,
    message,
    date
  } = req.body;

  // Basic validation
  if (!contactName || !phone || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ---------------------------------------------
    // TRANSPORTER
    // ---------------------------------------------
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // ---------------------------------------------
    // EMAIL CONTENT
    // ---------------------------------------------
    const mailOptions = {
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: email,
      subject: `New Contact Form: ${subject}`,
      text: `
New Contact Form Submission

Contact Name: ${contactName}
Company Name: ${companyName || "N/A"}
Phone: ${phone}
Email: ${email}
Date: ${date}

-----------------------------------

Message:
${message}
      `,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Contact Name:</strong> ${contactName}</p>
        <p><strong>Company Name:</strong> ${companyName || "N/A"}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Date:</strong> ${date}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `
    };

    // ---------------------------------------------
    // SEND EMAIL
    // ---------------------------------------------
    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

module.exports = router;
