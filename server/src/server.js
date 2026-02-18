import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import contactRoutes from "./routes/contact.js";

import checkoutRoutes from "./routes/checkoutRoutes.js";
import adminUsersRoutes from "./routes/adminUsersRoutes.js";

dotenv.config();
console.log("Stripe key exists:", Boolean(process.env.STRIPE_SECRET_KEY));
console.log("🔥 RUNNING server/src/server.js build:", new Date().toISOString());

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use((req, _res, next) => {
  console.log("➡️", req.method, req.path);
  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// ✅ health should not depend on DB connection
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);

app.use("/api/checkout", checkoutRoutes);
app.use("/api/admin/users", adminUsersRoutes);

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    console.log("ABOUT TO LISTEN ON PORT:", PORT);

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Server failed:", err);
    process.exit(1);
  }
})();
