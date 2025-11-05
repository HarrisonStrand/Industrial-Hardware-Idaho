import Product from "../models/Product.js";

export const listProducts = async (req, res) => {
  try {
    const { q, category } = req.query;
    const filter = {};
    if (q) filter.name = { $regex: q, $options: "i" };
    if (category) filter.category = category;
    const items = await Product.find(filter).limit(200).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.status(201).json(p);
  } catch (e) {
    res.status(400).json({ message: "Invalid product data" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json(p);
  } catch (e) {
    res.status(400).json({ message: "Invalid product data" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
};
