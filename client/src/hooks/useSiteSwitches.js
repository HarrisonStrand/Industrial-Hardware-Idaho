import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch.js";
import SITE_ACCESS from "../config/siteAccess.js";

// Cart and checkout on/off switches set in Admin > Catalog Layout.
// Fetched once per page load and shared by every caller. Until the server
// answers (or if it fails), the defaults in config/siteAccess.js apply.
const FALLBACK = {
	cartEnabled: Boolean(SITE_ACCESS?.cart?.enabled),
	checkoutEnabled: Boolean(SITE_ACCESS?.checkout?.enabled),
};

let cached = null;
let pending = null;
let settled = false;
const listeners = new Set();

function load(force = false) {
	if (!force && (cached || pending)) return pending || Promise.resolve(cached);

	pending = apiFetch("/api/catalog-layout/site-switches")
		.then((data) => {
			cached = {
				cartEnabled: data?.cartEnabled === true,
				checkoutEnabled: data?.checkoutEnabled === true,
			};
			return cached;
		})
		.catch((error) => {
			console.warn("Site switches unavailable, using defaults:", error);
			return null;
		})
		.finally(() => {
			pending = null;
			settled = true;
			listeners.forEach((notify) => notify(cached));
		});

	return pending;
}

// Call after an admin changes a switch so this tab picks it up at once.
export function refreshSiteSwitches() {
	return load(true);
}

export default function useSiteSwitches() {
	const [switches, setSwitches] = useState(cached);
	const [done, setDone] = useState(settled);

	useEffect(() => {
		const notify = (next) => {
			setSwitches(next);
			setDone(true);
		};
		listeners.add(notify);
		load();
		return () => listeners.delete(notify);
	}, []);

	return {
		...(switches || FALLBACK),
		loading: !done,
		fromServer: !!switches,
	};
}
