import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useToast } from "../../context/ToastContext";

// Fishbowl price sync: when it last ran, what changed on its own, and the changes waiting for an admin
// (drops to $0, first prices, and moves over 50%).

function money(value) {
	if (value === null || value === undefined) return "—";
	return `$${Number(value).toFixed(Number(value) < 1 ? 4 : 2)}`;
}

function when(value) {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function ChangeTable({ items, selectable = false, selected = new Set(), onToggle, onToggleAll }) {
	if (!items.length) return <div className='text-muted small'>Nothing here.</div>;
	const allPicked = selectable && items.every((item) => selected.has(item._id));
	return (
		<div className='table-responsive' style={{ maxHeight: 420 }}>
			<table className='table table-sm align-middle mb-0'>
				<thead>
					<tr>
						{selectable ? (
							<th>
								<input type='checkbox' aria-label='Pick all' checked={allPicked} onChange={onToggleAll} />
							</th>
						) : null}
						<th>Part #</th>
						<th>Description</th>
						<th className='text-end'>Website</th>
						<th className='text-end'>Fishbowl</th>
						<th>Why</th>
						<th>Found</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr key={item._id}>
							{selectable ? (
								<td>
									<input
										type='checkbox'
										aria-label={`Pick ${item.partNumber}`}
										checked={selected.has(item._id)}
										onChange={() => onToggle(item._id)}
									/>
								</td>
							) : null}
							<td className='text-nowrap'>{item.partNumber}</td>
							<td className='small'>{item.description}</td>
							<td className='text-end text-nowrap'>{money(item.oldPrice)}</td>
							<td className='text-end text-nowrap fw-semibold'>{money(item.newPrice)}</td>
							<td className='small text-nowrap'>{item.reason || "—"}</td>
							<td className='small text-nowrap text-muted'>{when(item.detectedAt)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default function AdminPriceSync() {
	const { showToast } = useToast();
	const [status, setStatus] = useState(null);
	const [pending, setPending] = useState([]);
	const [recent, setRecent] = useState([]);
	const [selected, setSelected] = useState(new Set());
	const [busy, setBusy] = useState("");
	const [checkResult, setCheckResult] = useState(null);
	const [showRecent, setShowRecent] = useState(false);

	const load = useCallback(async () => {
		try {
			const [statusData, pendingData, recentData] = await Promise.all([
				apiFetch("/api/fishbowl/price-sync/status"),
				apiFetch("/api/fishbowl/price-changes?status=pending&limit=500"),
				apiFetch("/api/fishbowl/price-changes?status=applied&limit=200"),
			]);
			setStatus(statusData);
			setPending(pendingData?.items || []);
			setRecent(recentData?.items || []);
			setSelected(new Set());
		} catch (err) {
			console.error("Failed to load price sync", err);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function run(dryRun) {
		if (!dryRun && !window.confirm("Update website prices from Fishbowl now? Big changes will wait for your OK.")) return;
		try {
			setBusy(dryRun ? "check" : "run");
			const data = await apiFetch("/api/fishbowl/price-sync/run", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dryRun }),
			});
			const result = data?.result || {};
			setCheckResult(result);
			showToast({
				variant: result.stopped ? "danger" : "success",
				message: result.stopped
					? result.message
					: dryRun
						? `Check done: ${result.stats?.applied || 0} would update, ${result.stats?.held || 0} would wait for you.`
						: `Prices updated: ${result.stats?.applied || 0}. Waiting for you: ${result.stats?.held || 0}.`,
				duration: 6000,
			});
			await load();
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Price sync failed", duration: 6000 });
		} finally {
			setBusy("");
		}
	}

	async function decide(decision, all = false) {
		const ids = [...selected];
		if (!all && !ids.length) return;
		const count = all ? Number(status?.pendingCount ?? pending.length) : ids.length;
		const verb = decision === "approve" ? "Approve" : "Reject";
		if (!window.confirm(`${verb} ${count} price change${count === 1 ? "" : "s"}?`)) return;
		try {
			setBusy(decision);
			await apiFetch("/api/fishbowl/price-changes/decide", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(all ? { decision, all: true } : { decision, ids }),
			});
			showToast({ variant: "success", message: `${verb}d ${count}.`, duration: 3500 });
			await load();
		} catch (err) {
			showToast({ variant: "danger", message: err.message || "Could not save", duration: 5000 });
		} finally {
			setBusy("");
		}
	}

	function toggle(id) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		setSelected((current) =>
			pending.every((item) => current.has(item._id)) ? new Set() : new Set(pending.map((item) => item._id)),
		);
	}

	const schedule = status?.schedule || {};
	const lastRun = status?.lastRun || null;
	const running = Boolean(status?.runtime?.running) || busy === "run" || busy === "check";

	return (
		<div className='border rounded-4 p-4 mt-4'>
			<div className='d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3'>
				<div>
					<div className='text-main text-uppercase fs-5 mb-1'>Fishbowl Price Sync</div>
					<div className='text-muted small'>
						Compares every website price with Fishbowl. Normal changes update on their own; a drop to $0,
						a first price, or a move over 50% waits below for your OK.
					</div>
					<div className='small mt-2'>
						Nightly run:{" "}
						{schedule.enabled ? (
							<>on, next {when(schedule.nextRunAt)}</>
						) : (
							<span className='text-muted'>off (set FISHBOWL_PRICE_SYNC_ENABLED=true on the server)</span>
						)}
						<br />
						Last run: {lastRun ? `${when(lastRun.startedAt)} · ${lastRun.status}` : "never"}
					</div>
				</div>
				<div className='d-flex flex-wrap gap-2 align-items-start'>
					<button type='button' className='btn btn-outline-secondary rounded-3' disabled={running} onClick={() => run(true)}>
						{busy === "check" ? "Checking…" : "Check Fishbowl (no changes)"}
					</button>
					<button
						type='button'
						className='btn-main-cta rounded-3 text-uppercase px-3 py-2 text-main-light'
						disabled={running}
						onClick={() => run(false)}>
						{busy === "run" ? "Updating…" : "Update Prices Now"}
					</button>
				</div>
			</div>

			{checkResult?.stats ? (
				<div className='alert alert-light border small'>
					{checkResult.dryRun ? "Check only (nothing changed): " : "Last run: "}
					{checkResult.stats.matched} products matched · {checkResult.stats.applied}{" "}
					{checkResult.dryRun ? "would update" : "updated"} · {checkResult.stats.held} waiting for you ·{" "}
					{checkResult.stats.unmatched} not in Fishbowl
				</div>
			) : null}

			<div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2'>
				<div className='text-main fw-semibold'>
					Waiting for your OK ({Number(status?.pendingCount ?? pending.length)}
					{Number(status?.pendingCount || 0) > pending.length ? `, newest ${pending.length} shown` : ""})
				</div>
				<div className='d-flex flex-wrap gap-2'>
					<button
						type='button'
						className='btn btn-outline-secondary btn-sm rounded-3'
						disabled={!selected.size || !!busy}
						onClick={() => decide("approve")}>
						Approve picked
					</button>
					<button
						type='button'
						className='btn btn-outline-secondary btn-sm rounded-3'
						disabled={!selected.size || !!busy}
						onClick={() => decide("reject")}>
						Reject picked
					</button>
					<button
						type='button'
						className='btn btn-outline-secondary btn-sm rounded-3'
						disabled={!pending.length || !!busy}
						onClick={() => decide("approve", true)}>
						Approve all
					</button>
				</div>
			</div>
			<ChangeTable items={pending} selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} />

			<button type='button' className='btn btn-link px-0 mt-3' onClick={() => setShowRecent((value) => !value)}>
				{showRecent ? "Hide" : "Show"} recent automatic changes ({recent.length})
			</button>
			{showRecent ? <ChangeTable items={recent} /> : null}
		</div>
	);
}
