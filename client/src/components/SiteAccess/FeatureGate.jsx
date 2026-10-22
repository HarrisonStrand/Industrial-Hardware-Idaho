import { useLocation } from "react-router-dom";
import siteAccess from "../../config/siteAccess";
import { useAuth } from "../../context/AuthContext.jsx";
import useSiteSwitches from "../../hooks/useSiteSwitches.js";
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

	const switches = useSiteSwitches();

	const featureConfig = feature ? siteAccess?.[feature] || {} : {};
	// Cart and checkout come from the admin switches (database); while those
	// load or if they fail, the hook returns the siteAccess.js defaults.
	const switchValue =
		feature === "cart"
			? switches.cartEnabled
			: feature === "checkout"
				? switches.checkoutEnabled
				: undefined;
	const isEnabled =
		typeof enabled === "boolean"
			? enabled
			: typeof switchValue === "boolean"
				? switchValue
				: Boolean(featureConfig?.enabled);

	if (isEnabled) {
		return children;
	}

	if (loadingAuth || (switchValue !== undefined && switches.loading)) {
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
