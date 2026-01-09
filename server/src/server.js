import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import contactRoute from "./routes/contact.js";

dotenv.config();

try {
  await connectDB();
} catch (e) {
  console.warn("⚠️ MongoDB not connected — continuing without DB");
}

const app = express();

app.use(cookieParser());
app.use(express.json());

// If you’re using Vite on 3000 and API on 5000, this is the safe cookie setup:
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true
  })
);

app.get("/", (_req, res) => res.json({ status: "API running" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/contact", contactRoute);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
