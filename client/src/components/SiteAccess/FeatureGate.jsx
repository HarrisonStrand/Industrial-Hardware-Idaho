import { useLocation } from "react-router-dom";
import siteAccess from "../../config/siteAccess";
import { useAuth } from "../../context/AuthContext.jsx";
import ComingSoonPage from "./ComingSoonPage.jsx";

export default function FeatureGate({
	feature = "",
	enabled = null,
	title = "Coming Soon",
	description = "",
	backTo = "/",
	backLabel = "Back Home",
	children,
	fallback = null,
}) {
	const location = useLocation();
	const { isAdmin, loadingAuth } = useAuth();

	const featureConfig = feature ? siteAccess?.[feature] || {} : {};
	const isEnabled =
		typeof enabled === "boolean"
			? enabled
			: Boolean(featureConfig?.enabled);

	if (isEnabled) {
		return children;
	}

	if (loadingAuth) {
		return null;
	}

	if (isAdmin) {
		return children;
	}

	if (fallback) {
		return fallback;
	}

	return (
		<ComingSoonPage
			title={title || featureConfig?.title || "Coming Soon"}
			description={description || featureConfig?.description || ""}
			backTo={backTo || location.state?.from || "/"}
			backLabel={backLabel || "Back Home"}
		/>
	);
}
