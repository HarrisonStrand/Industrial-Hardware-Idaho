import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../../../context/CartContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { fetchCatalogProductBySlug } from "../../../services/catalogApi.js";
import "./ProductDetail.css";

export default function CatalogProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItemCount } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVendorOfferingId, setSelectedVendorOfferingId] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchCatalogProductBySlug(slug);
        if (!alive) return;

        setProduct(data);

        if (data?.preferredVendor?.vendorOfferingId) {
          setSelectedVendorOfferingId(data.preferredVendor.vendorOfferingId);
        }
      } catch (error) {
        console.error("Failed to load catalog product:", error);
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  const selectedVendor = useMemo(() => {
    if (!product) return null;

    if (!selectedVendorOfferingId) {
      return product.preferredVendor || null;
    }

    return (
      product.vendorOptions?.find(
        (option) => option.vendorOfferingId === selectedVendorOfferingId
      ) || product.preferredVendor || null
    );
  }, [product, selectedVendorOfferingId]);

  const displayPrice = useMemo(() => {
    if (!product) return 0;
    return Number(
      selectedVendor?.price ??
        product?.pricing?.preferredVendorPrice ??
        product?.pricing?.basePrice ??
        0
    );
  }, [product, selectedVendor]);

  const primaryImage =
    product?.images?.find((img) => img.isPrimary)?.url ||
    product?.images?.[0]?.url ||
    "";

  const handleAddToCart = () => {
    if (!product) return;

    const qty = Math.max(1, Number(quantity || 1));

    addToCart({
      productId: product.productId,
      vendorOfferingId: selectedVendor?.vendorOfferingId || null,
      quantity: qty,
      sku: product.sku,
      slug: product.slug,
      title: product.title,
      image: primaryImage,
      attributes: product.attributes || {},
      price: displayPrice,
      category: product.category,
      subcategory: product.subcategory,
      vendorName: selectedVendor?.vendorName || "",
      vendorPartNumber: selectedVendor?.vendorPartNumber || "",
      shortDescription: product.shortDescription || "",
    });

    showToast({
      message: qty > 1 ? `Added ${qty} items to cart` : "Added to cart",
      variant: "success",
      actionLabel: "View Cart",
      onAction: () => navigate("/cart"),
      duration: 4000,
    });
  };

  if (loading) {
    return (
      <div className="theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5">
        <div className="theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5">
          <div className="text-main">Loading product…</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <h2 className="text-center mt-5">Product not found.</h2>;
  }

  return (
    <div className="theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5">
      <div className="theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5">
        <div className="theme-title text-center text-main fs-1 py-3 text-uppercase">
          {product.title}
        </div>

        <div className="product-description-card row p-3 rounded-4 m-0">
          <div className="col-12 col-lg-4">
            <div className="product-image-card rounded-4 overflow-hidden">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={product.title}
                  className="product-image"
                />
              ) : (
                <div className="p-4 text-center text-muted">No image available</div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="product-description rounded-4 overflow-hidden">
              <div className="description-title text-main text-decoration-underline fs-3 text-uppercase">
                Description
              </div>
              <div className="description-copy fs-5 text-main">
                {product.description}
              </div>

              {product.bulletPoints?.length > 0 && (
                <div className="mt-4">
                  <div className="text-main text-uppercase small fw-bold mb-2">
                    Product Details
                  </div>
                  <ul className="text-main mb-0">
                    {product.bulletPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {product.vendorOptions?.length > 0 && (
                <div className="mt-4">
                  <label className="form-label text-uppercase small fw-bold mb-1 text-main">
                    Vendor Source
                  </label>
                  <select
                    className="product-option-dropdown form-select form-control rounded-3 text-secondary option-select form-input"
                    value={selectedVendorOfferingId}
                    onChange={(e) => setSelectedVendorOfferingId(e.target.value)}
                  >
                    {product.vendorOptions.map((option) => (
                      <option
                        key={option.vendorOfferingId}
                        value={option.vendorOfferingId}
                      >
                        {option.vendorName}
                        {option.isPreferred ? " (Preferred)" : ""}
                        {typeof option.qtyAvailable === "number"
                          ? ` • Qty ${option.qtyAvailable}`
                          : ""}
                        {option.price != null ? ` • $${Number(option.price).toFixed(2)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4">
                <label className="form-label text-uppercase small fw-bold mb-1 text-main">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-control rounded-3 text-secondary option-select form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="main-linebreak border-0 border-top border-main py-2 w-75 mx-auto" />

        <div className="row bottom-price-row">
          <div className="col-12 col-md-4" />

          <div className="col-12 col-md-4 text-center">
            <div className="d-flex justify-content-center align-items-center gap-4">
              <button
                className="btn-main-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>

              {cartItemCount > 0 && (
                <button
                  className="btn-main-cta btn-secondary-cta justify-content-center text-center rounded-4 text-uppercase fw-regular fs-4 py-4 text-main"
                  onClick={() => navigate("/cart")}
                  type="button"
                >
                  View Cart
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-4 price-container text-end fs-1 text-main font-secondary pt-3 pt-md-0">
            ${Number(displayPrice * Number(quantity || 1)).toFixed(2)}
            <div className="fs-6 text-muted">
              ${Number(displayPrice || 0).toFixed(2)} each
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}