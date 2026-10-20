// client/src/pages/AdminDashboard/BulkPublishPanel.jsx
// Bulk publish by part-number list, enrichment batch or category page.
// "Check" only reports; "Publish" is enabled after a check of the same selection and asks first.
import { useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch.js";

const MODES = [
	{ key: "list", label: "Part numbers" },
	{ key: "batch", label: "Enrichment batch" },
	{ key: "page", label: "Category page" },
];

const OUTCOME_LABELS = {
	"would-publish": "Would publish",
	published: "Published",
	blocked: "Blocked",
	"already-published": "Already published",
	inactive: "Inactive",
	"not-found": "Not found",
	failed: "Failed",
};

const PART_LIST_KEY = "ihi.bulkPublish.partList";

function loadPartList() {
	try {
		const saved = JSON.parse(window.localStorage.getItem(PART_LIST_KEY) || "[]");
		return Array.isArray(saved) ? saved : [];
	} catch {
		return [];
	}
}

function savePartList(list) {
	try {
		window.localStorage.setItem(PART_LIST_KEY, JSON.stringify(list));
	} catch {
		// Storage can be full or blocked; the list still works for this visit.
	}
}

export default function BulkPublishPanel({ onPublished }) {
	const [mode, setMode] = useState("list");
	const [partNumbersText, setPartNumbersText] = useState("");
	const [batchId, setBatchId] = useState("");
	const [category, setCategory] = useState("");
	const [subcategory, setSubcategory] = useState("");
	const [result, setResult] = useState(null);
	const [checkedKey, setCheckedKey] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	// Every product from every check or publish run is appended here (latest result wins),
	// kept in this browser only, so a list of checked parts builds up across batches.
	const [partList, setPartList] = useState(loadPartList);

	const selection = useMemo(() => {
		if (mode === "list") {
			return { partNumbers: partNumbersText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
		}
		if (mode === "batch") return { batchId: batchId.trim() };
		return { category: category.trim(), subcategory: subcategory.trim() };
	}, [mode, partNumbersText, batchId, category, subcategory]);

	const selectionKey = JSON.stringify(selection);
	const hasSelection =
		(selection.partNumbers && selection.partNumbers.length > 0) ||
		!!selection.batchId ||
		(!!selection.category && !!selection.subcategory);
	const wouldPublish = result?.dryRun ? result?.counts?.["would-publish"] || 0 : 0;
	const canPublish = !loading && result?.dryRun && checkedKey === selectionKey && wouldPublish > 0;

	async function run(dryRun) {
		setLoading(true);
		setError("");
		try {
			const data = await apiFetch("/api/products/admin/bulk-publish", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...selection, dryRun }),
			});
			setResult(data);
			setCheckedKey(dryRun ? selectionKey : "");
			appendToPartList(data?.rows || []);
			if (!dryRun && typeof onPublished === "function") onPublished();
		} catch (err) {
			setError(err.message || "Bulk publish failed");
		} finally {
			setLoading(false);
		}
	}

	function sourceLabel() {
		if (selection.batchId) return selection.batchId;
		if (selection.category) return `${selection.category} / ${selection.subcategory}`;
		return "Pasted list";
	}

	function appendToPartList(rows) {
		const source = sourceLabel();
		setPartList((previous) => {
			const byPart = new Map(previous.map((item) => [item.partNumber, item]));
			for (const row of rows) {
				byPart.set(row.partNumber, {
					source,
					partNumber: row.partNumber,
					description: row.description || "",
					title: row.title || "",
					outcome: row.outcome,
					reason: row.reason || "",
				});
			}
			const next = Array.from(byPart.values());
			savePartList(next);
			return next;
		});
	}

	function clearPartList() {
		if (!window.confirm("Clear the checked parts list?")) return;
		setPartList([]);
		savePartList([]);
	}

	function downloadPartList() {
		const header = ["Source", "Part number", "IHI description", "Website title", "Result", "Reason"];
		const lines = [header, ...partList.map((item) => [item.source, item.partNumber, item.description, item.title, OUTCOME_LABELS[item.outcome] || item.outcome, item.reason])]
			.map((cells) => cells.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","));
		const blob = new Blob([lines.join("\n")], { type: "text/csv" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "checked-parts.csv";
		link.click();
		URL.revokeObjectURL(link.href);
	}

	function handlePublish() {
		if (!canPublish) return;
		if (!window.confirm(`Publish ${wouldPublish} products? They will show on the website.`)) return;
		run(false);
	}

	const blockedRows = (result?.rows || []).filter((row) => ["blocked", "not-found", "failed", "inactive"].includes(row.outcome));

	return (
		<div className='theme-card-container card shadow-sm rounded-4 border-0'>
			<div className='card-body d-flex flex-column gap-3'>
				<div>
					<div className='text-main text-uppercase fs-5'>Bulk Publish</div>
					<div className='text-muted small'>
						Choose products, press Check to see what would happen (nothing is saved), then Publish.
					</div>
				</div>

				<div className='d-flex flex-wrap gap-2'>
					{MODES.map((item) => (
						<button
							key={item.key}
							type='button'
							className={`btn rounded-3 ${mode === item.key ? "btn-dark" : "btn-outline-dark"}`}
							onClick={() => setMode(item.key)}
							disabled={loading}>
							{item.label}
						</button>
					))}
				</div>

				{mode === "list" ? (
					<textarea
						className='form-control'
						rows={5}
						placeholder='One IHI part number per line'
						value={partNumbersText}
						onChange={(e) => setPartNumbersText(e.target.value)}
					/>
				) : null}
				{mode === "batch" ? (
					<input
						className='form-control'
						placeholder='One or more batch ids, separated by commas, for example B-001, B-002'
						value={batchId}
						onChange={(e) => setBatchId(e.target.value)}
					/>
				) : null}
				{mode === "page" ? (
					<div className='d-flex flex-column flex-md-row gap-2'>
						<input
							className='form-control'
							placeholder='Category, for example bolts'
							value={category}
							onChange={(e) => setCategory(e.target.value)}
						/>
						<input
							className='form-control'
							placeholder='Subcategory, for example flat-head-cap-screws'
							value={subcategory}
							onChange={(e) => setSubcategory(e.target.value)}
						/>
					</div>
				) : null}

				<div className='d-flex flex-wrap gap-2'>
					<button type='button' className='btn btn-outline-dark rounded-3 px-4' onClick={() => run(true)} disabled={loading || !hasSelection}>
						{loading ? "Working…" : "Check"}
					</button>
					<button type='button' className='btn btn-dark rounded-3 px-4' onClick={handlePublish} disabled={!canPublish}>
						{wouldPublish > 0 ? `Publish ${wouldPublish} products` : "Publish"}
					</button>
				</div>

				{error ? <div className='alert alert-danger mb-0'>{error}</div> : null}

				{result ? (
					<div className='d-flex flex-column gap-2'>
						<div className='small text-muted'>
							{result.dryRun ? "Check only, nothing was saved." : "Publish finished."} {result.total} products in this selection.
						</div>
						<div className='d-flex flex-wrap gap-2'>
							{Object.entries(result.counts || {}).map(([outcome, count]) => (
								<span key={outcome} className='badge text-bg-light border'>
									{OUTCOME_LABELS[outcome] || outcome}: {count}
								</span>
							))}
						</div>
						{blockedRows.length ? (
							<div className='table-responsive' style={{ maxHeight: 320 }}>
								<table className='table table-sm mb-0'>
									<thead>
										<tr>
											<th>Part number</th>
											<th>Result</th>
											<th>Reason</th>
										</tr>
									</thead>
									<tbody>
										{blockedRows.map((row, index) => (
											<tr key={`${row.partNumber}-${index}`}>
												<td>{row.partNumber}</td>
												<td>{OUTCOME_LABELS[row.outcome] || row.outcome}</td>
												<td className='small'>{row.reason || ""}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</div>
				) : null}

				{partList.length ? (
					<div className='d-flex flex-column gap-2'>
						<div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
							<div className='text-main text-uppercase small'>Checked parts ({partList.length})</div>
							<div className='d-flex gap-2'>
								<button type='button' className='btn btn-sm btn-outline-dark rounded-3' onClick={downloadPartList}>
									Download CSV
								</button>
								<button type='button' className='btn btn-sm btn-outline-secondary rounded-3' onClick={clearPartList}>
									Clear list
								</button>
							</div>
						</div>
						<div className='table-responsive' style={{ maxHeight: 420 }}>
							<table className='table table-sm mb-0'>
								<thead>
									<tr>
										<th>Source</th>
										<th>Part number</th>
										<th>IHI description</th>
										<th>Website title</th>
										<th>Result</th>
									</tr>
								</thead>
								<tbody>
									{partList.map((item) => (
										<tr key={item.partNumber}>
											<td className='small text-nowrap'>{item.source}</td>
											<td className='text-nowrap'>{item.partNumber}</td>
											<td className='small'>{item.description}</td>
											<td className='small'>{item.title}</td>
											<td className='small' title={item.reason || ""}>
												{OUTCOME_LABELS[item.outcome] || item.outcome}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
