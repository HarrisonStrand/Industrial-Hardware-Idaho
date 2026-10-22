import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import "./StockSplit.css";

// How many of a line ship now and how many wait for restock.
export function splitStock(quantity, available) {
	const qty = Math.max(0, Math.floor(Number(quantity || 0)));
	const stock = Math.max(0, Math.floor(Number(available || 0)));
	const inStock = Math.min(qty, stock);
	return { inStock, backordered: qty - inStock };
}

// Current stock for a list of product ids (fetched once per change of the id list).
export function useStockLevels(productIds = []) {
	const key = useMemo(() => [...new Set(productIds.filter(Boolean).map(String))].sort().join(","), [productIds]);
	const [stock, setStock] = useState({});
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let alive = true;
		if (!key) {
			setStock({});
			setLoaded(true);
			return undefined;
		}
		setLoaded(false);
		apiFetch("/api/stock", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ productIds: key.split(",") }),
		})
			.then((data) => {
				if (alive) setStock(data?.stock || {});
			})
			.catch(() => {
				if (alive) setStock({});
			})
			.finally(() => {
				if (alive) setLoaded(true);
			});
		return () => {
			alive = false;
		};
	}, [key]);

	return { stock, loaded };
}

// One line of text under a cart / checkout / product line. Shows nothing when everything is in stock
// or when the stock level is unknown.
export default function StockSplit({ quantity, available, compact = false }) {
	if (available === undefined || available === null) return null;
	const { inStock, backordered } = splitStock(quantity, available);
	if (!backordered) return null;

	const text =
		inStock > 0
			? `${inStock.toLocaleString()} ship now · ${backordered.toLocaleString()} backordered`
			: compact
				? "Backordered"
				: `Backordered (${backordered.toLocaleString()}) · ships when restocked`;

	return (
		<div className='stock-split small' role='note'>
			<i className='bi bi-clock-history me-1' aria-hidden='true' />
			{text}
		</div>
	);
}
