import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch.js";

// Local draft preview. The server answers /api/preview-status
// only when it runs with CATALOG_PREVIEW=drafts; everywhere else the request fails and this stays false.
// Production builds skip the request entirely.
let cached = false;
let pending = null;
let settled = false;
const listeners = new Set();

function load() {
	// A production build (the deployed site) never asks: preview exists only on the local dev server.
	if (!import.meta.env.DEV) return Promise.resolve(false);
	if (settled) return Promise.resolve(cached);
	if (pending) return pending;

	pending = apiFetch("/api/preview-status")
		.then((data) => {
			cached = data?.previewMode === true;
			return cached;
		})
		.catch(() => {
			cached = false;
			return false;
		})
		.finally(() => {
			pending = null;
			settled = true;
			listeners.forEach((notify) => notify(cached));
		});

	return pending;
}

export default function useDraftPreview() {
	const [previewMode, setPreviewMode] = useState(cached);

	useEffect(() => {
		listeners.add(setPreviewMode);
		load().then(setPreviewMode);
		return () => listeners.delete(setPreviewMode);
	}, []);

	return previewMode;
}
