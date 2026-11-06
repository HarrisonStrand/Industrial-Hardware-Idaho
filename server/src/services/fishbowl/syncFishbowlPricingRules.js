// Copies Fishbowl's pricing rules, product categories, list prices and costs into the website database,
// then works out every product's Retail and House rule price (fishbowlPricingRules.js).
//
// Fishbowl is only read (SELECT queries through GET /api/data-query). Website prices do not change here:
// they follow these rule prices only when Admin > Pricing is switched to "Fishbowl rules".

import SyncRun from "../../models/SyncRun.js";
import { FishbowlPricingSnapshot, FishbowlProductPrice } from "../../models/FishbowlPricing.js";
import { FishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import { isDraftPreview } from "../catalog/draftPreview.js";
import { websiteRulePrices } from "./fishbowlPricingRules.js";

const PAGE = 5000;
const MIN_RULES = 20; // fewer active rules than this means Fishbowl's answer is wrong: stop
const MIN_PRODUCTS = 5000;

let activeRun = null;

export function getFishbowlPricingRulesRuntimeState() {
	return { running: Boolean(activeRun) };
}

async function select(client, sql) {
	if (!/^\s*select\s/i.test(sql)) throw new Error("Only SELECT queries are sent to Fishbowl");
	const resp = await client.request({ method: "GET", path: `/api/data-query?query=${encodeURIComponent(sql)}` });
	if (!resp.ok || !Array.isArray(resp.data)) {
		throw new Error(`Fishbowl data query failed (status ${resp.status})`);
	}
	return resp.data;
}

async function selectAll(client, sql, orderBy) {
	const rows = [];
	for (let offset = 0; offset < 200000; offset += PAGE) {
		const page = await select(client, `${sql} ORDER BY ${orderBy} LIMIT ${PAGE} OFFSET ${offset}`);
		rows.push(...page);
		if (page.length < PAGE) break;
	}
	return rows;
}

async function runCopy({ triggeredBy = "manual" } = {}) {
	if (isDraftPreview()) throw new Error("The Fishbowl rules copy does not run in draft preview (read-only).");

	const startedAt = new Date();
	const syncRun = await SyncRun.create({
		jobType: "fishbowl-pricing-rules",
		status: "running",
		startedAt,
		metadata: { triggeredBy },
	});
	const client = new FishbowlClient();

	try {
		const rules = await select(
			client,
			"SELECT id, name, paTypeId, paBaseAmountTypeId, paPercent, paAmount, productInclTypeId, productInclId, customerInclTypeId, customerInclId, isTier2, qtyApplies, qtyMin, qtyMax, dateApplies, dateBegin, dateEnd, isAutoApply, isActive FROM pricingrule WHERE isActive = 1",
		);
		const tree = await select(client, "SELECT id, name, parentId FROM producttree");
		const products = await selectAll(
			client,
			"SELECT p.id AS productId, p.num AS productNum, p.price AS listPrice, pt.num AS partNumber, pt.stdCost AS stdCost, pc.avgCost AS avgCost FROM product p JOIN part pt ON pt.id = p.partId LEFT JOIN partcost pc ON pc.partId = pt.id",
			"p.id",
		);
		const links = await selectAll(client, "SELECT productId, productTreeId FROM producttotree", "id");

		if (rules.length < MIN_RULES || products.length < MIN_PRODUCTS) {
			throw new Error(
				`Fishbowl sent ${rules.length} rules and ${products.length} products; stopped without changing anything.`,
			);
		}

		const treeById = new Map(tree.map((row) => [Number(row.id), row]));
		const treeIdsByProduct = new Map();
		for (const link of links) {
			const key = Number(link.productId);
			if (!treeIdsByProduct.has(key)) treeIdsByProduct.set(key, []);
			treeIdsByProduct.get(key).push(Number(link.productTreeId));
		}

		// One row per part number; the Fishbowl product numbered like the part wins.
		const byPart = new Map();
		for (const row of products) {
			const part = String(row.partNumber || "").trim();
			if (!part) continue;
			const current = byPart.get(part);
			if (!current || (String(row.productNum) === part && String(current.productNum) !== part)) byPart.set(part, row);
		}

		const now = new Date();
		const ops = [];
		let ruled = 0;
		for (const [part, row] of byPart) {
			const product = {
				fishbowlProductId: Number(row.productId),
				listPrice: row.listPrice === null ? null : Number(row.listPrice),
				stdCost: row.stdCost === null ? null : Number(row.stdCost),
				avgCost: row.avgCost === null ? null : Number(row.avgCost),
				treeIds: treeIdsByProduct.get(Number(row.productId)) || [],
			};
			const prices = websiteRulePrices(product, rules, treeById);
			if (prices.RETAIL?.source === "rule") ruled += 1;
			ops.push({
				updateOne: {
					filter: { partNumber: part },
					update: { $set: { ...product, partNumber: part, prices, syncedAt: now } },
					upsert: true,
				},
			});
		}

		for (let i = 0; i < ops.length; i += 1000) {
			await FishbowlProductPrice.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
		}
		// Parts gone from Fishbowl drop out of the copy.
		const removed = await FishbowlProductPrice.deleteMany({ syncedAt: { $lt: now } });

		const counts = {
			rules: rules.length,
			categories: tree.length,
			fishbowlProducts: products.length,
			parts: byPart.size,
			retailByRule: ruled,
			removed: removed.deletedCount || 0,
		};
		await FishbowlPricingSnapshot.findOneAndUpdate(
			{ key: "default" },
			{ $set: { rules, tree, counts, syncedAt: now } },
			{ upsert: true },
		);

		await SyncRun.updateOne(
			{ _id: syncRun._id },
			{
				$set: {
					status: "success",
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
					stats: { found: byPart.size, created: 0, updated: byPart.size, skipped: 0, failed: 0 },
					metadata: { triggeredBy, ...counts },
				},
			},
		);
		return { ok: true, counts };
	} catch (err) {
		await SyncRun.updateOne(
			{ _id: syncRun._id },
			{
				$set: {
					status: "failed",
					finishedAt: new Date(),
					durationMs: Date.now() - startedAt.getTime(),
					notes: err?.message || "Fishbowl rules copy failed",
				},
			},
		);
		throw err;
	} finally {
		await client.logout().catch(() => {});
	}
}

export async function runFishbowlPricingRulesCopy(options = {}) {
	if (activeRun) {
		const err = new Error("The Fishbowl rules copy is already running.");
		err.status = 409;
		throw err;
	}
	activeRun = runCopy(options);
	try {
		return await activeRun;
	} finally {
		activeRun = null;
	}
}
