// Products with no picture are kept out of category listings and search for now.
// Their product pages still open by direct link. Set SHOW_PRODUCTS_WITHOUT_IMAGE=true to list them again.
export function hideProductsWithoutImage() {
	return process.env.SHOW_PRODUCTS_WITHOUT_IMAGE !== "true";
}

export function hasProductImage(enrichment = {}) {
	return (enrichment?.images || []).some((image) => Boolean(image?.url));
}

export function isListedForImage(enrichment = {}) {
	return !hideProductsWithoutImage() || hasProductImage(enrichment);
}
