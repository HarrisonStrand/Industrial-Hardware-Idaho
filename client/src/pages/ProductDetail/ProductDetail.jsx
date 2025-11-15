import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import categoriesData from "../../data/categories.json";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { categoryId, subcategoryId } = useParams();
  const [subcategory, setSubcategory] = useState(null);

  const [selected, setSelected] = useState({
    finish: "",
    grade: "",
    quantity: "",
    thread_pitch: "",
    diameter: "",
    length: ""
  });

  useEffect(() => {
    const category = categoriesData.categories.find(
      (c) => c.id.toLowerCase() === categoryId.toLowerCase()
    );

    if (!category) return;

    const sub = category.subcategories.find(
      (s) => s.id.toLowerCase() === subcategoryId.toLowerCase()
    );

    if (sub) setSubcategory(sub);
  }, [categoryId, subcategoryId]);

  if (!subcategory) {
    return <h2 className="text-center mt-5">Product not found.</h2>;
  }

  const attributes = subcategory.attributes || {};

  const handleChange = (attr, value) => {
    setSelected((prev) => ({ ...prev, [attr]: value }));
  };

  const handleAddToCart = () => {
    console.log("Adding to cart:", {
      subcategory: subcategory.id,
      ...selected
    });

    alert("Product added to cart!");
  };

  return (
    <div className="container my-5 product-detail fade-in">
      <div className="row g-5">
        {/* IMAGE */}
        <div className="col-12 col-lg-6">
          <div className="product-image-card shadow-sm rounded-4 overflow-hidden">
            <img
              src={subcategory.image}
              alt={subcategory.name}
              className="w-100 h-100 object-fit-cover"
            />
          </div>
        </div>

        {/* OPTIONS */}
        <div className="col-12 col-lg-6">
          <h1 className="fw-bold text-main mb-2">{subcategory.name}</h1>

          <p className="text-secondary mb-4">
            Choose your specifications below:
          </p>

          {/* DROPDOWNS */}
          {Object.entries(attributes).map(([key, values]) => (
            <div key={key} className="mb-3">
              <label className="form-label text-uppercase small fw-bold">
                {key.replace("_", " ")}
              </label>

              <select
                className="form-select shadow-sm option-select"
                value={selected[key]}
                onChange={(e) => handleChange(key, e.target.value)}
              >
                <option value="">Select {key.replace("_", " ")}</option>
                {values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            className="btn btn-main px-4 py-2 mt-3 shadow"
            onClick={handleAddToCart}
            disabled={Object.values(selected).includes("")}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
