import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";

function slugify(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CatalogProductRedirect() {
  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await apiFetch(`/api/catalog/product/${slug}`);
        if (!alive) return;

        const product = data?.product || data || null;
        if (!product) {
          navigate("/products", { replace: true });
          return;
        }

        const categoryId =
          product.categorySlug ||
          slugify(product.category || "");

        const subcategoryId =
          product.subcategorySlug ||
          slugify(product.subcategory || "");

        if (!categoryId || !subcategoryId) {
          navigate("/products", { replace: true });
          return;
        }

        const params = new URLSearchParams();

        const attrs =
          product.attributes ||
          product.enrichment?.attributes ||
          {};

        if (product.productId) {
          params.set("productId", String(product.productId));
        }

        const partNumber =
          attrs.fishbowlPartNum ||
          product.sku ||
          product.internalPartNumber ||
          "";

        if (partNumber) {
          params.set("partNumber", String(partNumber));
        }

        if (product.sku) {
          params.set("sku", String(product.sku));
        }

        Object.entries(attrs).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.set(key, String(value));
          }
        });

        if (slug) {
          params.set("slug", slug);
        }

        navigate(
          `/products/${categoryId}/${subcategoryId}?${params.toString()}`,
          { replace: true }
        );
      } catch (err) {
        console.error("Catalog product redirect failed:", err);
        navigate("/products", { replace: true });
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug, navigate]);

  return <div className="text-center mt-5">Loading product…</div>;
}