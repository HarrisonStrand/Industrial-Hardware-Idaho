// Nightly Fishbowl price sync: reads every product price from Fishbowl (GET /api/products) and compares it
// with the website's stored price (products.pricing.basePrice).
//
// - Normal changes go live at once and are logged in PriceChange (status "applied").
// - A drop to $0, a first price, or a move over 50% waits for an admin (status "pending").
// - The run stops without changing anything when Fishbowl's answer looks wrong (see checkRunLimits).
// The rules themselves are plain code in priceChangeRules.js.

import Product from "../../models/Product.js";
import PriceChange from "../../models/PriceChange.js";
import SyncRun from "../../models/SyncRun.js";
import { FishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import { isDraftPreview } from "../catalog/draftPreview.js";
import {
	checkRunLimits,
	classifyPriceChange,
	pickFishbowlPrice,
	toPrice,
} from "./priceChangeRules.js";

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

let activeRun = null;
let lastResult = null;

export function getFishbowlPriceSyncRuntimeState() {
	return { running: Boolean(activeRun), lastResult };
}

// Every Fishbowl product, grouped by its part number.
async function fetchFishbowlPrices(client) {
	const byPart = new Map();
	let total = 0;
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const resp = await client.request({
			method: "GET",
			path: `/api/products?pageNumber=${page}&pageSize=${PAGE_SIZE}`,
		});
		if (!resp.ok) {
			throw new Error(`Fishbowl products request failed (page ${page}, status ${resp.status})`);
		}
		const rows = Array.isArray(resp.data?.results) ? resp.data.results : [];
		for (const row of rows) {
			const part = String(row?.partNumber || "").trim();
			if (!part) continue;
			if (!byPart.has(part)) byPart.set(part, []);
			byPart.get(part).push(row);
		}
		total += rows.length;
		const totalPages = Number(resp.data?.totalPages || 0);
		if (!rows.length || (totalPages && page >= totalPages)) break;
	}
	return { byPart, total };
}

function productKey(product) {
	return String(product?.fishbowl?.partNum || product?.sku || "").trim();
}

function sample(list, size = 25) {
	return list.slice(0, size).map((row) => ({
		partNumber: row.partNumber,
		oldPrice: row.oldPrice,
		newPrice: row.newPrice,
		reason: row.reason,
	}));
}

async function runPriceSync({ dryRun = false, triggeredBy = "manual" } = {}) {
	if (isDraftPreview()) {
		throw new Error("The price sync does not run in draft preview (read-only).");
	}

	const startedAt = new Date();
	const syncRun = await SyncRun.create({
		jobType: "fishbowl-prices",
		status: "running",
		startedAt,
		metadata: { dryRun, triggeredBy },
	});

	const client = new FishbowlClient();
	try {
		const { byPart, total } = await fetchFishbowlPrices(client);

		const products = await Product.find(
			{},
			{ sku: 1, "fishbowl.partNum": 1, "fishbowl.description": 1, "pricing.basePrice": 1 },
		).lean();

		const [pendingRows, rejectedRows] = await Promise.all([
			PriceChange.find({ status: "pending" }).lean(),
			PriceChange.find({ status: "rejected" }).sort({ decidedAt: -1 }).lean(),
		]);
		const pendingByProduct = new Map(pendingRows.map((row) => [String(row.productId), row]));
		const rejectedByProduct = new Map();
		for (const row of rejectedRows) {
			const key = String(row.productId);
			if (!rejectedByProduct.has(key)) rejectedByProduct.set(key, row);
		}

		const apply = [];
		const hold = [];
		const clear = [];
		let expected = 0;
		let matched = 0;
		let skipped = 0;

		for (const product of products) {
			const key = productKey(product);
			if (!key) continue;
			expected += 1;
			const rows = byPart.get(key);
			if (!rows) continue;
			matched += 1;

			const newPrice = pickFishbowlPrice(rows, key);
			const oldPrice = toPrice(product?.pricing?.basePrice);
			const decision = classifyPriceChange(oldPrice, newPrice);
			const id = String(product._id);
			const pending = pendingByProduct.get(id);
			const row = {
				productId: product._id,
				partNumber: key,
				description: product?.fishbowl?.description || "",
				oldPrice,
				newPrice,
				changePct:
					decision.changePct !== undefined ? Math.round(decision.changePct * 10) / 10 : null,
				reason: decision.reason,
			};

			if (decision.action === "skip") {
				skipped += 1;
				continue;
			}
			if (decision.action === "same") {
				if (pending) clear.push(pending);
				continue;
			}
			if (decision.action === "apply") {
				apply.push(row);
				if (pending) clear.push(pending);
				continue;
			}
			// Held: ask once. Not again for a price an admin already turned down, nor for the same pending price.
			const rejected = rejectedByProduct.get(id);
			if (rejected && toPrice(rejected.newPrice) === newPrice) continue;
			if (pending && toPrice(pending.newPrice) === newPrice) continue;
			hold.push({ ...row, pendingId: pending?._id || null });
		}

		const stats = {
			fishbowlProducts: total,
			expected,
			matched,
			unmatched: expected - matched,
			skipped,
			applied: apply.length,
			held: hold.length,
			cleared: clear.length,
		};

		const limitMessage = checkRunLimits({ matched, expected, changing: apply.length });
		if (limitMessage) {
			await SyncRun.updateOne(
				{ _id: syncRun._id },
				{
					$set: {
						status: "failed",
						finishedAt: new Date(),
						durationMs: Date.now() - startedAt.getTime(),
						notes: limitMessage,
						metadata: { dryRun, triggeredBy, ...stats },
					},
				},
			);
			return { ok: false, stopped: true, message: limitMessage, dryRun, stats };
		}

		if (!dryRun) {
			const now = new Date();
			if (apply.length) {
				await Product.bulkWrite(
					apply.map((row) => ({
						updateOne: {
							filter: { _id: row.productId },
							update: {
								$set: {
									"pricing.basePrice": row.newPrice,
									"pricing.priceSource": "fishbowl",
									"pricing.lastSyncedAt": now,
								},
							},
						},
					})),
					{ ordered: false },
				);
				await PriceChange.insertMany(
					apply.map((row) => ({ ...row, status: "applied", detectedAt: now, syncRunId: syncRun._id })),
				);
			}

			for (const row of hold) {
				const { pendingId, ...fields } = row;
				if (pendingId) {
					await PriceChange.updateOne(
						{ _id: pendingId, status: "pending" },
						{ $set: { ...fields, detectedAt: now, syncRunId: syncRun._id } },
					);
				} else {
					await PriceChange.create({ ...fields, status: "pending", detectedAt: now, syncRunId: syncRun._id });
				}
			}

			if (clear.length) {
				await PriceChange.updateMany(
					{ _id: { $in: clear.map((row) => row._id) }, status: "pending" },
					{ $set: { status: "cleared", decidedAt: now, decidedBy: "fishbowl-price-sync" } },
				);
			}
		}

		await SyncRun.updateOne(
			{ _id: syncRun._id },
			{
				$set: {
					status: "success",
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
					stats: {
						found: matched,
						created: 0,
						updated: dryRun ? 0 : apply.length,
						skipped: skipped + stats.unmatched,
						failed: 0,
					},
					metadata: { dryRun, triggeredBy, ...stats },
				},
			},
		);

		return {
			ok: true,
			dryRun,
			stats,
			appliedSample: sample(apply),
			heldSample: sample(hold),
		};
	} catch (err) {
		await SyncRun.updateOne(
			{ _id: syncRun._id },
			{
				$set: {
					status: "failed",
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
					notes: err?.message || "Price sync failed",
				},
			},
		);
		throw err;
	} finally {
		await client.logout().catch(() => {});
	}
}

export async function runFishbowlPriceSync(options = {}) {
	if (activeRun) {
		const err = new Error("Fishbowl price sync is already running.");
		err.code = "FISHBOWL_PRICE_SYNC_RUNNING";
		err.status = 409;
		throw err;
	}
	activeRun = runPriceSync(options);
	try {
		lastResult = await activeRun;
		return lastResult;
	} finally {
		activeRun = null;
	}
}

// Admin decision on waiting changes. Approve writes the new price; reject keeps the old one and the
// sync will not ask about that same price again.
export async function decidePriceChanges({ ids = [], all = false, decision, decidedBy = "" } = {}) {
	if (!["approve", "reject"].includes(decision)) throw new Error("decision must be approve or reject");
	if (isDraftPreview()) throw new Error("Price changes cannot be decided in draft preview (read-only).");

	const filter = { status: "pending" };
	if (!all) filter._id = { $in: ids };
	const rows = await PriceChange.find(filter).lean();
	const now = new Date();

	if (decision === "approve") {
		for (const row of rows) {
			await Product.updateOne(
				{ _id: row.productId },
				{
					$set: {
						"pricing.basePrice": row.newPrice,
						"pricing.priceSource": "fishbowl",
						"pricing.lastSyncedAt": now,
					},
				},
			);
		}
	}

	await PriceChange.updateMany(
		{ _id: { $in: rows.map((row) => row._id) }, status: "pending" },
		{ $set: { status: decision === "approve" ? "approved" : "rejected", decidedAt: now, decidedBy } },
	);

	return { decided: rows.length, decision };
}
