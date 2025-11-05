import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();
await connectDB();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => res.json({ status: "API running" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
