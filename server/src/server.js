import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import contactRoute from "./routes/contact.js";
import userRoutes from "./routes/userRoutes.js";
import specialRequestsRoute from "./routes/specialRequestsRoute.js";
import billingRoutes from "./routes/billingRoutes.js";

dotenv.config();

const app = express();

// ✅ Put CORS early so it handles preflight before routes
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());

// Routes that can run regardless of DB should go above the DB gate (optional)
// app.use("/api/contact", contactRoute);

app.use("/api/users", userRoutes);
app.use("/api/special-requests", specialRequestsRoute);
app.use("/api/billing", billingRoutes);

app.get("/", (_req, res) => res.json({ status: "API running" }));

let dbReady = false;

async function start() {
  try {
    await connectDB();
    dbReady = true;
  } catch (e) {
    console.warn("⚠️ MongoDB not connected — auth routes will return 503");
    console.warn(e?.message || e);
  }

  // If DB isn’t ready, prevent auth routes from crashing the app
  app.use("/api/auth", (req, res, next) => {
    if (!dbReady) {
      return res.status(503).json({ error: "Database unavailable" });
    }
    next();
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/contact", contactRoute);

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}

start();
