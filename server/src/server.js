import "./config/env.js";

import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import contactRoutes from "./routes/contact.js";

import checkoutRoutes from "./routes/checkoutRoutes.js";
import adminUsersRoutes from "./routes/adminUsersRoutes.js";
import adminOrdersRoutes from "./routes/adminOrdersRoutes.js"
import stripeWebhookRoutes from "./routes/stripeWebhookRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

import fishbowlRoutes from "./routes/fishbowlRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import catalogBuilderRoutes from "./routes/catalogBuilderRoutes.js";


console.log("Stripe key loaded?", Boolean(process.env.STRIPE_SECRET_KEY));
console.log("🔥 RUNNING server/src/server.js build:", new Date().toISOString());

const app = express();

app.use("/api/stripe", stripeWebhookRoutes);
app.use(express.json());
app.use(cookieParser());

app.use((req, _res, next) => {
  console.log("➡️", req.method, req.path);
  next();
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    credentials: true
  })
);

// ✅ health should not depend on DB connection
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);

app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin", adminOrdersRoutes);

app.use("/api/fishbowl", fishbowlRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/catalog-builder", catalogBuilderRoutes);

app.use("/public", express.static(path.resolve("public")));

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
