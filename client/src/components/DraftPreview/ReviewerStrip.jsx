import "./DraftPreview.css";

// Small line naming a row for review. The server sends `preview` only in draft preview mode,
// so with preview off `info` is undefined and nothing renders.
export default function ReviewerStrip({ info, className = "" }) {
	if (!info) return null;

	const maker = [info.maker, info.makerNumber].filter(Boolean).join(" / ");
	const parts = [
		info.ihiPartNumber ? `IHI ${info.ihiPartNumber}` : "",
		info.partId ? `ID ${info.partId}` : "",
		info.batch || "",
		maker ? `${maker}${info.confidence ? ` (${info.confidence})` : ""}` : "no maker",
		info.status || "",
		info.qa ? `QA ${info.qa}` : "",
	].filter(Boolean);

	return (
		<div className={`draft-preview-strip ${className}`} title='Draft preview reviewer info'>
			{parts.join(" · ")}
		</div>
	);
}
