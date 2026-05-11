import express from "express";
import dotenv from "dotenv";
import contactRoutes from "./src/routes/contact.js";
import newsletterRoutes from "./src/routes/newsletterRoutes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/contact", contactRoutes);
app.use("/api/newsletter", newsletterRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
