import { apiFetch } from "../utils/apiFetch.js";

export async function fetchGlobalSearch(query, options = {}) {
	const params = new URLSearchParams();
	params.set("q", query || "");

	if (options.productLimit !== undefined) {
		params.set("productLimit", String(options.productLimit));
	}

	if (options.builderLimit !== undefined) {
		params.set("builderLimit", String(options.builderLimit));
	}

	return apiFetch(`/api/search?${params.toString()}`, {
		signal: options.signal,
	});
}
