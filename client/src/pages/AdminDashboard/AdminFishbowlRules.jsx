import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useToast } from "../../context/ToastContext";

// Where website prices come from: the markups on this page, or Fishbowl's own pricing rules
// (copied nightly). Shows how prices would change before switching.

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const BUCKETS = [
	"more than 50% lower",
	"lower",
	"same (within 1%)",
	"higher",
	"more than 50% higher",
	"no rule price",
];

function when(value) {
	if (!value) return "never";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "never" : date.toLocaleString();
}

function money(value) {
	return value === null || value === undefined ? "—" : `$${Number(value).toFixed(2)}`;
}

export default function AdminFishbowlRules({ onModeChange }) {
	const { showToast } = useToast();
	const [status, setStatus] = useState(null);
	const [report, setReport] = useState(null);
	const [busy, setBusy] = useState("");

	const loadStatus = useCallback(async () => {
		try {
			setStatus(await apiFetch("/api/fishbowl/pricing-rules/status"));
		} catch (err) {
			console.error("Failed to load Fishbowl rules status", err);
		}
	}, []);

	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	async function copyNow() {
		try {
			setBusy("copy");
			const data = await apiFetch("/api/fishbowl/pricing-rules/copy", { method: "POST" });
			const counts = data?.result?.counts || {};
			showToast({
				variant: "success",
				message: `Copied ${counts.rules || 0} rules and ${counts.parts || 0} products from Fishbowl.`,
				duration: 5000,
			});
			setReport(null);
			await loadStatus();
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Copy failed", duration: 6000 });
		} finally {
			setBusy("");
		}
	}

	async function compare() {
		try {
			setBusy("compare");
			setReport(await apiFetch("/api/fishbowl/pricing-rules/compare"));
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Compare failed", duration: 6000 });
		} finally {
			setBusy("");
		}
	}

	async function downloadCsv() {
		try {
			setBusy("csv");
			const res = await fetch(`${API_BASE}/api/fishbowl/pricing-rules/compare.csv`, { credentials: "include" });
			if (!res.ok) throw new Error(`Download failed (${res.status})`);
			const url = URL.createObjectURL(await res.blob());
			const link = document.createElement("a");
			link.href = url;
			link.download = "price-comparison.csv";
			link.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Download failed", duration: 6000 });
		} finally {
			setBusy("");
		}
	}

	async function setMode(priceMode) {
		const message =
			priceMode === "fishbowl-rules"
				? "Switch website prices to Fishbowl's pricing rules now? Prices change on the site right away."
				: "Switch website prices back to the markups on this page?";
		if (!window.confirm(message)) return;
		try {
			setBusy("mode");
			await apiFetch("/api/admin/pricing-settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ priceMode }),
			});
			showToast({
				variant: "success",
				message: priceMode === "fishbowl-rules" ? "Website prices now follow Fishbowl's rules." : "Website prices now use the markups.",
				duration: 5000,
			});
			await loadStatus();
			onModeChange?.(priceMode);
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Could not switch", duration: 6000 });
		} finally {
			setBusy("");
		}
	}

	const mode = status?.priceMode || "markup";
	const copied = Boolean(status?.copiedAt);

	return (
		<div className='border rounded-4 p-4 mb-4'>
			<div className='d-flex flex-column flex-lg-row justify-content-between gap-3'>
				<div>
					<div className='text-main text-uppercase fs-5 mb-1'>Where Prices Come From</div>
					<div className='text-muted small mb-2'>
						<strong>Markups</strong>: the Fishbowl list price times the Retail / House / Net 30 markups below.{" "}
						<strong>Fishbowl rules</strong>: the price Fishbowl's own pricing rules give (Retail customers follow
						RETAIL CUSTOMER rules; House and Net 30 follow HOUSE ACCOUNT rules). Rules are copied from Fishbowl
						nightly; products with no rule use the Fishbowl list price.
					</div>
					<div className='small'>
						Now using: <strong>{mode === "fishbowl-rules" ? "Fishbowl rules" : "Markups"}</strong>
						<br />
						Rules copied: {when(status?.copiedAt)}
						{copied ? ` · ${status.counts?.rules || 0} rules · ${status.counts?.parts || 0} products` : ""}
					</div>
				</div>
				<div className='d-flex flex-wrap gap-2 align-items-start'>
					<button type='button' className='btn btn-outline-secondary rounded-3' disabled={!!busy} onClick={copyNow}>
						{busy === "copy" ? "Copying…" : "Copy Rules From Fishbowl"}
					</button>
					<button type='button' className='btn btn-outline-secondary rounded-3' disabled={!!busy || !copied} onClick={compare}>
						{busy === "compare" ? "Comparing…" : "Compare Prices"}
					</button>
					{mode === "fishbowl-rules" ? (
						<button type='button' className='btn btn-outline-secondary rounded-3' disabled={!!busy} onClick={() => setMode("markup")}>
							Use Markups
						</button>
					) : (
						<button
							type='button'
							className='btn-main-cta rounded-3 text-uppercase px-3 py-2 text-main-light'
							disabled={!!busy || !copied}
							onClick={() => setMode("fishbowl-rules")}>
							Use Fishbowl Rules
						</button>
					)}
				</div>
			</div>

			{report ? (
				<div className='mt-3'>
					<div className='small text-muted mb-2'>
						{report.products} published products: the website price today compared with the Fishbowl rule price.
					</div>
					<div className='table-responsive'>
						<table className='table table-sm align-middle mb-2'>
							<thead>
								<tr>
									<th>Change with Fishbowl rules</th>
									<th className='text-end'>Retail</th>
									<th className='text-end'>House / Net 30</th>
								</tr>
							</thead>
							<tbody>
								{BUCKETS.map((key) => (
									<tr key={key}>
										<td>{key}</td>
										<td className='text-end'>{report.summary?.RETAIL?.[key] || 0}</td>
										<td className='text-end'>{report.summary?.HOUSE?.[key] || 0}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<button type='button' className='btn btn-link px-0' disabled={!!busy} onClick={downloadCsv}>
						{busy === "csv" ? "Preparing…" : "Download the full list (CSV)"}
					</button>
					<div className='small fw-semibold mt-2 mb-1'>Biggest Retail changes</div>
					<div className='table-responsive' style={{ maxHeight: 360 }}>
						<table className='table table-sm align-middle mb-0'>
							<thead>
								<tr>
									<th>Part #</th>
									<th>Product</th>
									<th className='text-end'>Today</th>
									<th className='text-end'>Fishbowl</th>
									<th>Rule</th>
								</tr>
							</thead>
							<tbody>
								{(report.biggestChanges || []).map((row) => (
									<tr key={row.partNumber}>
										<td className='text-nowrap'>{row.partNumber}</td>
										<td className='small'>{row.title}</td>
										<td className='text-end'>{money(row.RETAIL_today)}</td>
										<td className='text-end fw-semibold'>{money(row.RETAIL_fishbowl)}</td>
										<td className='small'>{row.RETAIL_rule}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}
		</div>
	);
}
