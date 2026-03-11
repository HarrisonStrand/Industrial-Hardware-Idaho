import Product from "../../models/Product.js";

export async function markProductCurated(productId, options = {}) {
  if (!productId) {
    throw new Error("productId is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  product.isCurated = true;

  if (product.catalogStatus === "draft") {
    product.catalogStatus = "mapped";
  }

  if (typeof options.needsReview === "boolean") {
    product.needsReview = options.needsReview;
  }

  await product.save();

  return {
    action: "curated",
    product,
  };
}

export default markProductCurated;