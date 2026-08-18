import { SITE_ACCESS } from "../../config/siteAccess.js";
import "./CustomerPreviewBanner.css";

export default function CustomerPreviewBanner() {
	const preview = SITE_ACCESS?.previewBanner || {};

	if (preview.enabled === false) return null;

	return (
		<div className='customer-preview-banner' role='status' aria-label='Customer preview notice'>
			<div className='customer-preview-banner__inner'>
				<span className='customer-preview-banner__badge'>
					{preview.label || "Customer Preview"}
				</span>

				<span className='customer-preview-banner__message customer-preview-banner__message--desktop'>
					{preview.message ||
						"You're viewing a test version of the new IHI website. Some products and features are still being prepared for launch."}
				</span>

				<span className='customer-preview-banner__message customer-preview-banner__message--mobile'>
					{preview.mobileMessage ||
						"Test site — some products and features are still being prepared."}
				</span>
			</div>
		</div>
	);
}
