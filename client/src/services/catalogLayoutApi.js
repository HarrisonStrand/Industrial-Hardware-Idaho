import { apiFetch } from "../utils/apiFetch.js";

export function fetchCatalogLayouts() {
  return apiFetch("/api/catalog-layout");
}

export function fetchCatalogSubcategoryPage(
  categoryId,
  subcategoryId,
  options = {}
) {
  if (!categoryId || !subcategoryId) {
    throw new Error("categoryId and subcategoryId are required");
  }

  const query = new URLSearchParams();
  if (options.previewMode) query.set("previewMode", options.previewMode);
  const qs = query.toString();

  return apiFetch(
    `/api/catalog-layout/${categoryId}/${subcategoryId}${qs ? `?${qs}` : ""}`
  );
}

export function fetchAdminCatalogLayouts() {
  return apiFetch("/api/admin/catalog-layout");
}

export function updateAdminCatalogGlobalSettings(payload) {
  return apiFetch("/api/admin/catalog-layout/global", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export function updateAdminCatalogSubcategory(categoryId, subcategoryId, payload) {
  return apiFetch(`/api/admin/catalog-layout/${categoryId}/${subcategoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}
