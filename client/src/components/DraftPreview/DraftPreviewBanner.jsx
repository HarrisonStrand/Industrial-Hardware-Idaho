import useDraftPreview from "../../hooks/useDraftPreview.js";
import "./DraftPreview.css";

// Fixed banner shown only while the local server runs in draft preview mode.
export default function DraftPreviewBanner() {
	const previewMode = useDraftPreview();
	if (!previewMode) return null;

	return (
		<>
			<div className='draft-preview-banner' role='status'>
				DRAFT PREVIEW – local only, not the live site
			</div>
			<div className='draft-preview-banner-spacer' aria-hidden='true' />
		</>
	);
}
