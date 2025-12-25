import dotenv from "dotenv";
dotenv.config(); // ✅ MUST BE FIRST

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import contactRoute from "./routes/contact.js";

// 🔎 ENV DEBUG (KEEP THIS TEMPORARILY)
console.log("🔐 ENV CHECK:", {
  EMAIL_USER: process.env.EMAIL_USER,
  HAS_PASS: !!process.env.EMAIL_PASS,
  EMAIL_TO: process.env.EMAIL_TO
});

try {
  await connectDB();
  console.log("🟢 MongoDB connected");
} catch (err) {
  console.warn("⚠️ MongoDB not connected — continuing without DB");
}


const app = express();
// app.use(cors({ origin: true, credentials: true }));
app.use(cors());

app.use(express.json());

app.get("/", (_req, res) => res.json({ status: "API running" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", contactRoute);

app.use((req, _res, next) => {
  console.log("➡️ Incoming request:", req.method, req.originalUrl);
  next();
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`Server listening on :${PORT}`)
);
