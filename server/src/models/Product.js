import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, index: true },
  category: { type: String, index: true },
  description: String,
  price: { type: Number, required: true },
  stock: { type: Number, required: true, min: 0 },
  imageUrl: String,
  specs: { type: Map, of: String }
}, { timestamps: true });

export default mongoose.model("Product", productSchema);
