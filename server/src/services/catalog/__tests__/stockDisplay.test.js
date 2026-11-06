// Run: node --test src/services/catalog/__tests__/stockDisplay.test.js   (no database)
import test from "node:test";
import assert from "node:assert/strict";
import { isStockDisplayEnabled, splitOrderLineStock } from "../stockDisplay.js";

test("the switch is on unless it is set to false", () => {
	assert.equal(isStockDisplayEnabled(null), true);
	assert.equal(isStockDisplayEnabled({}), true);
	assert.equal(isStockDisplayEnabled({ stockDisplayEnabled: true }), true);
	assert.equal(isStockDisplayEnabled({ stockDisplayEnabled: false }), false);
});

test("switch on: the line splits into in stock and backordered", () => {
	assert.deepEqual(splitOrderLineStock(10, 4, true), { qtyInStock: 4, qtyBackordered: 6 });
	assert.deepEqual(splitOrderLineStock(10, 50, true), { qtyInStock: 10, qtyBackordered: 0 });
	assert.deepEqual(splitOrderLineStock(3, 0, true), { qtyInStock: 0, qtyBackordered: 3 });
	assert.deepEqual(splitOrderLineStock(3, undefined, true), { qtyInStock: 0, qtyBackordered: 3 });
});

test("switch off: nothing is backordered, even with no stock", () => {
	assert.deepEqual(splitOrderLineStock(10, 0, false), { qtyInStock: 10, qtyBackordered: 0 });
	assert.deepEqual(splitOrderLineStock(10, 4, false), { qtyInStock: 10, qtyBackordered: 0 });
});

test("bad numbers never go negative", () => {
	assert.deepEqual(splitOrderLineStock(-2, -5, true), { qtyInStock: 0, qtyBackordered: 0 });
	assert.deepEqual(splitOrderLineStock(2.9, 1.5, true), { qtyInStock: 1, qtyBackordered: 1 });
});
