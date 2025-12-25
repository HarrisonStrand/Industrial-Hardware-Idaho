import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

console.log("📧 MAILER CONFIG:", {
  host: process.env.EMAIL_HOST,
  user: process.env.EMAIL_USER,
  hasPass: !!process.env.EMAIL_PASS
});

export const transporter = nodemailer.createTransport({
  service: "gmail",               // ✅ IMPORTANT
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: process.env.EMAIL_PASS  // app password
  }
});

// 🔎 Verify connection on server start
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Mailer verification failed:", error);
  } else {
    console.log("✅ Mail server is ready to send emails");
  }
});

export async function sendContactEmail({
  name,
  company,
  email,
  phone,
  date,
  subject,
  message
}) {
  return transporter.sendMail({
    from: `"IHI Website" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo: email,
    subject: `Contact Form: ${subject}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Company:</strong> ${company || "N/A"}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "N/A"}</p>
      <p><strong>Date:</strong> ${date}</p>
      <hr />
      <p>${message.replace(/\n/g, "<br/>")}</p>
    `
  });
}
