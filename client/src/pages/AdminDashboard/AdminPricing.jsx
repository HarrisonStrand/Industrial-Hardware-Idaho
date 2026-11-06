import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import AdminPriceSync from "./AdminPriceSync.jsx";
import AdminFishbowlRules from "./AdminFishbowlRules.jsx";
import { useToast } from "../../context/ToastContext";
import "./AdminPricing.css";

function roundTo(value, places = 2) {
	const factor = 10 ** places;
	return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function multiplierToMarkupPercent(multiplier) {
	const safeMultiplier = Number(multiplier || 1);
	return roundTo((safeMultiplier - 1) * 100, 2);
}

function multiplierToMarginPercent(multiplier) {
	const safeMultiplier = Number(multiplier || 1);
	if (safeMultiplier <= 0) return 0;
	return roundTo(((safeMultiplier - 1) / safeMultiplier) * 100, 2);
}

function markupPercentToMultiplier(markupPercent) {
	const markup = Math.max(0, Number(markupPercent || 0));
	return roundTo(1 + markup / 100, 4);
}

function marginPercentToMultiplier(marginPercent) {
	const margin = Math.max(0, Number(marginPercent || 0));

	if (margin >= 100) {
		return 9999;
	}

	return roundTo(1 / (1 - margin / 100), 4);
}

function safePercentToMultiplier(value) {
	return markupPercentToMultiplier(Number(value || 0));
}

function sanitizePercentInput(value = "") {
	let next = String(value || "")
		.replace(/%/g, "")
		.replace(/[^\d.]/g, "");

	const parts = next.split(".");
	if (parts.length > 2) {
		next = `${parts[0]}.${parts.slice(1).join("")}`;
	}

	return next;
}

function displayPercentValue(value = "", isFocused = false) {
	const raw = String(value ?? "").trim();
	if (!raw) return "";
	return isFocused ? raw : `${raw}%`;
}

function isAllowedPercentKey(e) {
	const allowedControlKeys = [
		"Backspace",
		"Delete",
		"Tab",
		"Enter",
		"ArrowLeft",
		"ArrowRight",
		"ArrowUp",
		"ArrowDown",
		"Home",
		"End",
	];

	if (allowedControlKeys.includes(e.key)) return true;

	if (e.ctrlKey || e.metaKey) {
		const lower = e.key.toLowerCase();
		return ["a", "c", "v", "x"].includes(lower);
	}

	if (/^\d$/.test(e.key)) return true;

	if (e.key === ".") {
		return !e.currentTarget.value.includes(".");
	}

	return false;
}

function percentDisplay(value) {
	const num = Number(value || 0);
	return num === 0 ? "" : String(roundTo(num, 2));
}

function multiplierToRuleForm(label, multiplier) {
	const safeMultiplier = Number(multiplier || 1);

	return {
		label: label || "",
		marginPercent: percentDisplay(multiplierToMarginPercent(safeMultiplier)),
		markupPercent: percentDisplay(multiplierToMarkupPercent(safeMultiplier)),
	};
}

function prettyDate(value) {
	if (!value) return "Never";
	try {
		return new Date(value).toLocaleString();
	} catch {
		return "Unknown";
	}
}

export default function AdminPricing() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [updatedAt, setUpdatedAt] = useState("");
	const { showToast } = useToast();

	const [form, setForm] = useState({
		RETAIL: { label: "Retail", marginPercent: "", markupPercent: "" },
		HOUSE: { label: "House Account", marginPercent: "", markupPercent: "" },
		NET30: { label: "Net 30", marginPercent: "", markupPercent: "" },
	});

	const [focusedField, setFocusedField] = useState(null);
	// Fixed-price groups: sell at the Fishbowl price for every account (no markup).
	const [groups, setGroups] = useState([]);

	useEffect(() => {
		let alive = true;

		async function load() {
			try {
				setLoading(true);
				const data = await apiFetch("/api/admin/pricing-settings");

				if (!alive) return;

				const rules = data?.accountRules || {};

				setForm({
					RETAIL: multiplierToRuleForm(
						rules?.RETAIL?.label || "Retail",
						rules?.RETAIL?.multiplier ?? 1,
					),
					HOUSE: multiplierToRuleForm(
						rules?.HOUSE?.label || "House Account",
						rules?.HOUSE?.multiplier ?? 1,
					),
					NET30: multiplierToRuleForm(
						rules?.NET30?.label || "Net 30",
						rules?.NET30?.multiplier ?? 1,
					),
				});

				setGroups(Array.isArray(data?.fixedPriceGroups) ? data.fixedPriceGroups : []);
				setUpdatedAt(data?.updatedAt || "");
			} catch (err) {
				console.error("Failed to load pricing settings", err);
			} finally {
				if (alive) setLoading(false);
			}
		}

		load();

		return () => {
			alive = false;
		};
	}, []);

	function setLabel(type, value) {
		setForm((prev) => ({
			...prev,
			[type]: {
				...prev[type],
				label: value,
			},
		}));
	}

	function setMarkup(type, value) {
		const cleaned = sanitizePercentInput(value);

		if (cleaned === "") {
			setForm((prev) => ({
				...prev,
				[type]: {
					...prev[type],
					markupPercent: "",
					marginPercent: "",
				},
			}));
			return;
		}

		const markupPercent = Math.max(0, Number(cleaned || 0));
		const multiplier = markupPercentToMultiplier(markupPercent);
		const marginPercent = multiplierToMarginPercent(multiplier);

		setForm((prev) => ({
			...prev,
			[type]: {
				...prev[type],
				markupPercent: cleaned,
				marginPercent: percentDisplay(marginPercent),
			},
		}));
	}

	function setMargin(type, value) {
		const cleaned = sanitizePercentInput(value);

		if (cleaned === "") {
			setForm((prev) => ({
				...prev,
				[type]: {
					...prev[type],
					marginPercent: "",
					markupPercent: "",
				},
			}));
			return;
		}

		const marginPercent = Math.max(0, Number(cleaned || 0));
		const multiplier = marginPercentToMultiplier(marginPercent);
		const markupPercent = multiplierToMarkupPercent(multiplier);

		setForm((prev) => ({
			...prev,
			[type]: {
				...prev[type],
				marginPercent: cleaned,
				markupPercent: percentDisplay(markupPercent),
			},
		}));
	}

	const preview = useMemo(() => {
		const sampleBasePrice = 10;

		return {
			RETAIL: {
				sellPrice: roundTo(
					sampleBasePrice *
						markupPercentToMultiplier(form.RETAIL.markupPercent),
					2,
				),
				multiplier: markupPercentToMultiplier(form.RETAIL.markupPercent),
			},
			HOUSE: {
				sellPrice: roundTo(
					sampleBasePrice * markupPercentToMultiplier(form.HOUSE.markupPercent),
					2,
				),
				multiplier: markupPercentToMultiplier(form.HOUSE.markupPercent),
			},
			NET30: {
				sellPrice: roundTo(
					sampleBasePrice * markupPercentToMultiplier(form.NET30.markupPercent),
					2,
				),
				multiplier: markupPercentToMultiplier(form.NET30.markupPercent),
			},
		};
	}, [form]);

async function save() {
	try {
		setSaving(true);

		const payload = {
			accountRules: {
				RETAIL: {
					label: form.RETAIL.label,
					multiplier: safePercentToMultiplier(form.RETAIL.markupPercent),
				},
				HOUSE: {
					label: form.HOUSE.label,
					multiplier: safePercentToMultiplier(form.HOUSE.markupPercent),
				},
				NET30: {
					label: form.NET30.label,
					multiplier: safePercentToMultiplier(form.NET30.markupPercent),
				},
			},
			fixedPriceGroups: groups
				.map((group) => ({ ...group, value: String(group.value || "").trim() }))
				.filter((group) => group.value),
		};

		const data = await apiFetch("/api/admin/pricing-settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		setUpdatedAt(data?.settings?.updatedAt || "");
		if (Array.isArray(data?.settings?.fixedPriceGroups)) setGroups(data.settings.fixedPriceGroups);

		showToast({
			variant: "success",
			message: "Pricing settings saved",
			duration: 3500,
		});
	} catch (err) {
		console.error("Failed to save pricing settings", err);

		showToast({
			variant: "danger",
			message: err.message || "Failed to save pricing settings.",
			duration: 4500,
		});
	} finally {
		setSaving(false);
	}
}

	if (loading) {
		return <div className='text-muted'>Loading pricing settings…</div>;
	}

	return (
		<div>
			<div className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 mb-4'>
				<div>
					<div className='text-main text-uppercase mb-1 fs-4'>
						Pricing Rules
					</div>
					<div className='text-muted small'>
						Base price comes from Fishbowl. A margin or markup of 0% means the
						customer price is exactly the Fishbowl base price.
					</div>
				</div>

				<div className='text-muted small'>
					Last updated: {prettyDate(updatedAt)}
				</div>
			</div>

			<AdminFishbowlRules />

			<div className='row g-4'>
				{["RETAIL", "HOUSE", "NET30"].map((type) => (
					<div key={type} className='col-12 col-lg-4'>
						<div className='border rounded-4 p-4 h-100'>
							<div className='text-main text-uppercase fs-5 mb-3'>{type}</div>

							<div className='mb-3'>
								<label className='form-input-label form-label text-main text-uppercase small fw-bold mb-1'>
									Label
								</label>
								<input
									className='form-select form-control rounded-3 form-input'
									value={form[type].label}
									onChange={(e) => setLabel(type, e.target.value)}
								/>
							</div>

							<div className='mb-3'>
								<label className='form-input-label form-label text-main text-uppercase small fw-bold mb-1'>
									Margin %
								</label>
								<input
									type='text'
									inputMode='decimal'
									placeholder='0%'
									className='form-select form-control rounded-3 form-input'
									value={displayPercentValue(
										form[type].marginPercent,
										focusedField === `${type}-margin`,
									)}
									onFocus={() => setFocusedField(`${type}-margin`)}
									onBlur={() => setFocusedField(null)}
									onKeyDown={(e) => {
										if (!isAllowedPercentKey(e)) {
											e.preventDefault();
											return;
										}

										if (e.key === "Enter") {
											e.preventDefault();
											e.currentTarget.blur();
										}
									}}
									onPaste={(e) => {
										e.preventDefault();
										const pasted = e.clipboardData.getData("text");
										setMargin(type, sanitizePercentInput(pasted));
									}}
									onChange={(e) => setMargin(type, e.target.value)}
								/>
								<div className='text-muted small mt-1'>
									0 = base price, no margin added
								</div>
							</div>

							<div className='mb-3'>
								<label className='form-input-label form-label text-main text-uppercase small fw-bold mb-1'>
									Markup %
								</label>

								<input
									type='text'
									inputMode='decimal'
									placeholder='0%'
									className='form-select form-control rounded-3 form-input'
									value={displayPercentValue(
										form[type].markupPercent,
										focusedField === `${type}-markup`,
									)}
									onFocus={() => setFocusedField(`${type}-markup`)}
									onBlur={() => setFocusedField(null)}
									onKeyDown={(e) => {
										if (!isAllowedPercentKey(e)) {
											e.preventDefault();
											return;
										}

										if (e.key === "Enter") {
											e.preventDefault();
											e.currentTarget.blur();
										}
									}}
									onPaste={(e) => {
										e.preventDefault();
										const pasted = e.clipboardData.getData("text");
										setMarkup(type, sanitizePercentInput(pasted));
									}}
									onChange={(e) => setMarkup(type, e.target.value)}
								/>

								<div className='text-muted small mt-1'>
									0 = base price, no markup added
								</div>
							</div>

							<div className='border-top pt-3 mt-3'>
								<div className='text-muted small'>Stored multiplier</div>
								<div className='text-main fw-semibold'>
									{preview[type].multiplier.toFixed(4)}×
								</div>
							</div>

							<div className='border-top pt-3 mt-3'>
								<div className='text-muted small'>
									Example from $10.00 base price
								</div>
								<div className='text-main fw-semibold fs-5'>
									${preview[type].sellPrice.toFixed(2)}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>

			<div className='border rounded-4 p-4 mt-4'>
				<div className='text-main text-uppercase fs-5 mb-1'>Fixed-Price Groups</div>
				<div className='text-muted small mb-3'>
					Products in these groups sell at the Fishbowl price for every account (Retail, House and
					Net 30). The markups above do not apply to them. Pick by website category (e.g. strut) or by
					maker (e.g. Big Timber).
				</div>
				{groups.length ? (
					<div className='d-flex flex-column gap-2 mb-3'>
						{groups.map((group, index) => (
							<div key={index} className='d-flex flex-wrap align-items-center gap-2'>
								<select
									className='form-select rounded-3 w-auto'
									value={group.type}
									aria-label='Group type'
									onChange={(e) =>
										setGroups((list) =>
											list.map((row, i) => (i === index ? { ...row, type: e.target.value } : row)),
										)
									}>
									<option value='category'>Category</option>
									<option value='maker'>Maker</option>
								</select>
								<input
									className='form-control rounded-3'
									style={{ maxWidth: 280 }}
									value={group.value}
									placeholder={group.type === "maker" ? "Maker name" : "Category name"}
									aria-label='Group name'
									onChange={(e) =>
										setGroups((list) =>
											list.map((row, i) =>
												i === index ? { ...row, value: e.target.value, label: e.target.value } : row,
											),
										)
									}
								/>
								<button
									type='button'
									className='btn btn-outline-secondary rounded-3'
									onClick={() => setGroups((list) => list.filter((_, i) => i !== index))}>
									Remove
								</button>
							</div>
						))}
					</div>
				) : (
					<div className='text-muted small mb-3'>No fixed-price groups. Every product uses the markups above.</div>
				)}
				<button
					type='button'
					className='btn btn-outline-secondary rounded-3'
					onClick={() => setGroups((list) => [...list, { type: "category", value: "", label: "", multiplier: 1 }])}>
					Add Group
				</button>
			</div>

			<div className='d-flex justify-content-end mt-4'>
				<button
					className='btn-main-cta rounded-3 text-uppercase fw-regular py-2 px-4 text-main-light'
					onClick={save}
					disabled={saving}>
					{saving ? "Saving…" : "Save Pricing Rules"}
				</button>
			</div>

			<AdminPriceSync />
		</div>
	);
}
