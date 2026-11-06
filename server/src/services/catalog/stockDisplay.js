// The "show stock" switch (Admin > Catalog Layout). When it is off, the site shows no stock counts
// and no backorder notes, and new orders record no backorder split, so the store tells customers
// about backorders itself. Orders go through either way.

// A missing record or field means on, which keeps the behavior the site had before the switch.
export function isStockDisplayEnabled(setting) {
	return setting?.stockDisplayEnabled !== false;
}

// How many units of an order line ship now and how many wait for restock.
// With the switch off, the whole line counts as in stock and nothing is backordered.
export function splitOrderLineStock(quantity, available, stockDisplayEnabled = true) {
	const qty = Math.max(0, Math.floor(Number(quantity || 0)));
	if (!stockDisplayEnabled) return { qtyInStock: qty, qtyBackordered: 0 };
	const stock = Math.max(0, Math.floor(Number(available || 0)));
	const qtyInStock = Math.min(qty, stock);
	return { qtyInStock, qtyBackordered: qty - qtyInStock };
}
