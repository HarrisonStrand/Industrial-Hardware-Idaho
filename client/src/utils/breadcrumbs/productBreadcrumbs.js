export function getProductBreadcrumbs({
  categoryId,
  subcategoryId,
  typeId,
  productParams
}) {
  const crumbs = [
    { label: "Products", path: "/products" }
  ];

  if (!categoryId) return crumbs;

  const category = productParams.categories.find(
    c => c.id === categoryId
  );

  if (!category) return crumbs;

  crumbs.push({
    label: category.name,
    path: `/products?category=${category.id}`
  });

  if (!subcategoryId) return crumbs;

  const subcategory = category.subcategories?.find(
    s => s.id === subcategoryId
  );

  if (!subcategory) return crumbs;

  crumbs.push({
    label: subcategory.name,
    path: `/products?category=${category.id}&subcategory=${subcategory.id}`
  });

  if (!typeId || !subcategory.types) return crumbs;

  const type = subcategory.types.find(
    t => t.id === typeId
  );

  if (!type) return crumbs;

  crumbs.push({
    label: type.name
  });

  return crumbs;
}
