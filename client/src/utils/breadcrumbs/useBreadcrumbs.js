import { useLocation, useParams } from "react-router-dom";
import productParams from "../../data/product-parameters.json";
import { ROUTE_BREADCRUMBS } from "./routeBreadcrumbs";
import { getProductBreadcrumbs } from "./productBreadcrumbs";

export function useBreadcrumbs() {
  const location = useLocation();
  const params = useParams();

  const basePath = location.pathname;

  // 1️⃣ Static route breadcrumbs (cart, checkout, etc.)
  if (!basePath.startsWith("/products")) {
    return ROUTE_BREADCRUMBS[basePath] || [];
  }

  // 2️⃣ Product breadcrumbs
  return getProductBreadcrumbs({
    categoryId: params.categoryId,
    subcategoryId: params.subcategoryId,
    typeId: params.typeId,
    productParams
  });
}
