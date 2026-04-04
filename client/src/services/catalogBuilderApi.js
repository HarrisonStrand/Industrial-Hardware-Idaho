import { apiFetch } from "../utils/apiFetch";

export async function fetchCatalogBuilderSubcategory(categoryId, subcategoryId) {
  if (!categoryId || !subcategoryId) {
    throw new Error("categoryId and subcategoryId are required");
  }

  return apiFetch(`/api/catalog-builder/${categoryId}/${subcategoryId}`);
}