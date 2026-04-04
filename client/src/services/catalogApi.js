import { apiFetch } from "../utils/apiFetch";

export async function fetchCatalog(params = {}) {
  const query = new URLSearchParams();

  if (params.category) query.set("category", params.category);
  if (params.subcategory) query.set("subcategory", params.subcategory);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.skip) query.set("skip", String(params.skip));

  const qs = query.toString();
  return apiFetch(`/api/catalog${qs ? `?${qs}` : ""}`);
}

export async function fetchCatalogProductBySlug(slug) {
  if (!slug) throw new Error("slug is required");
  return apiFetch(`/api/catalog/product/${slug}`);
}