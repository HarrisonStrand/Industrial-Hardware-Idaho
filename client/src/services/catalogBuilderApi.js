import { apiFetch } from "../utils/apiFetch";

export async function fetchCatalogBuilderSubcategory(
  categoryId,
  subcategoryId,
  options = {}
) {
  if (!categoryId || !subcategoryId) {
    throw new Error("categoryId and subcategoryId are required");
  }

  const query = new URLSearchParams();
  if (options.includeUnpublished === true) {
    query.set("includeUnpublished", "true");
  }

  const qs = query.toString();
  return apiFetch(
    `/api/catalog-builder/${categoryId}/${subcategoryId}${qs ? `?${qs}` : ""}`
  );
}
