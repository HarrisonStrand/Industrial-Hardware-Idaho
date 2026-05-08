import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import siteAccess from "../../config/siteAccess";

export default function FeatureGate({
	feature,
	children,
	fallback = null,
}) {
	const location = useLocation();
	const [authReady, setAuthReady] = useState(false);
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function checkAuth() {
			try {
				const res = await fetch("/api/auth/me", {
					credentials: "include",
				});

				if (!res.ok) {
					if (!cancelled) {
						setIsAdmin(false);
						setAuthReady(true);
					}
					return;
				}

				const data = await res.json();
				const role = String(data?.user?.role || "").toLowerCase();

				if (!cancelled) {
					setIsAdmin(role === "admin");
					setAuthReady(true);
				}
			} catch {
				if (!cancelled) {
					setIsAdmin(false);
					setAuthReady(true);
				}
			}
		}

		checkAuth();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!authReady) return null;

	if (isAdmin) {
		return children;
	}

	const enabled = Boolean(siteAccess?.[feature]);

	if (enabled) {
		return children;
	}

	if (fallback) {
		return fallback;
	}

	return (
		<Navigate
			to="/coming-soon"
			replace
			state={{ from: location.pathname }}
		/>
	);
}