import express from "express";
import dotenv from "dotenv";
import contactRoutes from "./routes/contact.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/contact", contactRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
