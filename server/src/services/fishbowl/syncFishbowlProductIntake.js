import crypto from "crypto";

import Product from "../../models/Product.js";
import ProductEnrichment from "../../models/ProductEnrichment.js";
import SyncRun from "../../models/SyncRun.js";
import { fishbowlClient } from "../../integrations/fishbowl/fishbowlClient.js";
import upsertProductFromFishbowl from "../catalog/upsertProductFromFishbowl.js";
import createProductEnrichmentFromProduct from "../catalog/createProductEnrichmentFromProduct.js";

const PRODUCT_INTAKE_JOB_TYPE = "fishbowl-product-intake";
const DEFAULT_FISHBOWL_PARTS_PATH = "/api/parts";

let runtimeState = {
	running: false,
	startedAt: null,
	lastFinishedAt: null,
	lastResult: null,
	lastError: null,
};

function clean(value = "") {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function safeObject(value) {
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function asNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function boolEnv(name, fallback = false) {
	const value = process.env[name];
	if (value === undefined || value === null || value === "") return fallback;
	return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normalizePartKey(value = "") {
	return clean(value).toUpperCase();
}

function isSha256Hash(value = "") {
	return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

function stableStringify(value) {
	if (value === null || value === undefined) return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	if (typeof value === "object") {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function makeHash(value) {
	return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function getUomText(value) {
	if (!value) return "";
	if (typeof value === "string") return clean(value);
	if (typeof value === "object") {
		return clean(value.abbreviation || value.name || value.code || value.id || "");
	}
	return clean(value);
}

function getPartNumber(row = {}) {
	return clean(
		row.number ||
			row.partNumber ||
			row.partNum ||
			row.num ||
			row.sku ||
			row.name ||
			"",
	);
}

function normalizeFishbowlPartRow(row = {}) {
	const partNumber = getPartNumber(row);
	const description = clean(
		row.description || row.partDescription || row.partDescriptionText || row.name || "",
	);
	const uom = getUomText(row.uom || row.defaultUom || row.unitOfMeasure);
	const active =
		typeof row.active === "boolean"
			? row.active
			: typeof row.isActive === "boolean"
				? row.isActive
				: true;

	return {
		id: row.id ?? row.partId ?? "",
		partId: clean(row.id ?? row.partId ?? ""),
		partNumber,
		description,
		type: clean(row.type || row.partType || ""),
		status: clean(row.status || ""),
		uom,
		active,
		raw: row,
	};
}

function startsWithCleanupMarker(value = "") {
	return /^\*+/.test(clean(value));
}

function isCleanupCandidate(normalized = {}) {
	const partNumber = clean(normalized.partNumber || "");
	const description = clean(normalized.description || "");
	const combined = `${partNumber} ${description}`.toLowerCase();

	return (
		startsWithCleanupMarker(partNumber) ||
		startsWithCleanupMarker(description) ||
		/^fb-/i.test(partNumber) ||
		/(^|[\s_-])(zz+|void|delete|deleted|do not use|donotuse)([\s_-]|$)/i.test(combined) ||
		/discontinued/i.test(combined)
	);
}

function shouldSkipFishbowlPartRow(normalized = {}, { activeOnly = true, skipCleanupCandidates = true } = {}) {
	if (activeOnly && normalized.active === false) {
		return { skip: true, reason: "inactive" };
	}

	if (skipCleanupCandidates && isCleanupCandidate(normalized)) {
		return { skip: true, reason: "cleanup-candidate" };
	}

	return { skip: false, reason: "" };
}

function buildHashPayload(normalized = {}) {
	return {
		id: normalized.id,
		partId: normalized.partId,
		partNumber: normalized.partNumber,
		description: normalized.description,
		type: normalized.type,
		status: normalized.status,
		uom: normalized.uom,
		active: normalized.active,
		// Keep a stable snapshot of the source row so Fishbowl-side edits can be detected.
		raw: normalized.raw,
	};
}

function buildUpsertPayload(normalized = {}) {
	return {
		id: normalized.id,
		partId: normalized.partId,
		partNum: normalized.partNumber,
		partNumber: normalized.partNumber,
		number: normalized.partNumber,
		sku: normalized.partNumber,
		internalPartNumber: normalized.partNumber,
		description: normalized.description,
		partDescription: normalized.description,
		type: normalized.type,
		status: normalized.status,
		uom: normalized.uom,
		active: normalized.active,
		raw: normalized.raw,
	};
}

function buildChangeSummary(existingProduct = {}, normalized = {}) {
	const currentFishbowl = safeObject(existingProduct.fishbowl);
	const fields = [
		{
			key: "partNumber",
			label: "Part Number",
			previous: currentFishbowl.partNum || existingProduct.sku || "",
			next: normalized.partNumber || "",
		},
		{
			key: "description",
			label: "Description",
			previous: currentFishbowl.description || "",
			next: normalized.description || "",
		},
		{
			key: "type",
			label: "Type",
			previous: currentFishbowl.type || "",
			next: normalized.type || "",
		},
		{
			key: "uom",
			label: "UOM",
			previous: currentFishbowl.uom || "",
			next: normalized.uom || "",
		},
		{
			key: "active",
			label: "Active",
			previous: currentFishbowl.active !== false,
			next: normalized.active !== false,
		},
	];

	return fields.filter(
		(field) => String(field.previous ?? "") !== String(field.next ?? ""),
	);
}

function extractResults(data) {
	if (Array.isArray(data)) return data;
	if (!data || typeof data !== "object") return [];
	for (const key of ["results", "data", "items", "parts", "rows"]) {
		if (Array.isArray(data[key])) return data[key];
	}
	return [];
}

function getTotalPages(data) {
	return Math.max(1, Number(data?.totalPages || data?.pageCount || data?.pages || 1) || 1);
}

function appendQuery(path, params = {}) {
	const [base, existingQuery = ""] = String(path || "").split("?");
	const searchParams = new URLSearchParams(existingQuery);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		searchParams.set(key, String(value));
	}
	const qs = searchParams.toString();
	return qs ? `${base}?${qs}` : base;
}

async function fetchFishbowlPartRows({
	partsPath = DEFAULT_FISHBOWL_PARTS_PATH,
	pageSize = 100,
	pageLimit = 0,
	rowLimit = 0,
	activeOnly = true,
} = {}) {
	const rows = [];
	const errors = [];
	let pagesRequested = 0;
	let pagesFailed = 0;
	let totalPagesSeen = 1;

	for (let pageNumber = 1; pageNumber <= totalPagesSeen; pageNumber += 1) {
		if (pageLimit && pageNumber > pageLimit) break;
		if (rowLimit && rows.length >= rowLimit) break;

		const path = appendQuery(partsPath, {
			pageNumber,
			pageSize,
			...(activeOnly ? { active: true } : {}),
		});
		pagesRequested += 1;

		const resp = await fishbowlClient.request({ method: "GET", path });
		if (!resp.ok) {
			pagesFailed += 1;
			errors.push({ key: path, message: `Fishbowl request failed with status ${resp.status}`, payload: resp.data || resp.error || null });
			break;
		}

		const pageRows = extractResults(resp.data);
		totalPagesSeen = getTotalPages(resp.data);
		rows.push(...pageRows);

		if (!pageRows.length) break;
	}

	return {
		rows: rowLimit ? rows.slice(0, rowLimit) : rows,
		pagesRequested,
		pagesFailed,
		totalPagesSeen,
		errors,
	};
}

function buildExistingProductMaps(products = []) {
	const byPartNumber = new Map();
	const byPartId = new Map();

	for (const product of products) {
		const partNumberCandidates = [
			product?.fishbowl?.partNum,
			product?.sku,
			product?.internalPartNumber,
		]
			.map(normalizePartKey)
			.filter(Boolean);

		for (const key of partNumberCandidates) {
			if (!byPartNumber.has(key)) byPartNumber.set(key, product);
		}

		const partId = clean(product?.fishbowl?.partId || "");
		if (partId && !byPartId.has(partId)) byPartId.set(partId, product);
	}

	return { byPartNumber, byPartId };
}

async function ensureNewProductEnrichment(product) {
	if (!product?._id) return { action: "skipped" };
	const existing = await ProductEnrichment.findOne({ productId: product._id }).lean();
	if (existing) return { action: "existing" };
	return createProductEnrichmentFromProduct(product._id);
}

function getStoredBaselineHash(product = {}) {
	const intakeHash = clean(product?.fishbowlIntake?.sourceHash || "");
	if (isSha256Hash(intakeHash)) return intakeHash;

	const legacySourceHash = clean(product?.sourceHashes?.fishbowlHash || "");
	if (isSha256Hash(legacySourceHash)) return legacySourceHash;

	return "";
}

function isPendingIntake(product = {}) {
	const status = clean(product?.fishbowlIntake?.status || "").toLowerCase();
	return status === "new" || status === "changed";
}

async function markProductAsNewIntake({ product, normalized, hash, now, triggeredBy }) {
	product.fishbowlIntake = {
		...(product.fishbowlIntake?.toObject?.() || product.fishbowlIntake || {}),
		status: "new",
		changeType: "new-product",
		firstDetectedAt: product?.fishbowlIntake?.firstDetectedAt || now,
		lastDetectedAt: now,
		lastReviewedAt: null,
		sourceHash: hash,
		previousHash: "",
		currentHash: hash,
		sourcePartNumber: normalized.partNumber || "",
		pendingFishbowlSnapshot: buildHashPayload(normalized),
		changeSummary: [],
		detectedBy: triggeredBy || "product-intake-scan",
	};

	product.sourceHashes = {
		...(product.sourceHashes?.toObject?.() || product.sourceHashes || {}),
		fishbowlHash: hash,
	};
	product.needsReview = true;
	if (!product.catalogStatus || product.catalogStatus === "draft") {
		product.catalogStatus = "mapped";
	}

	await product.save();
}

async function flagExistingProductChange({ productId, normalized, previousHash, currentHash, now, triggeredBy }) {
	const product = await Product.findById(productId);
	if (!product) return null;

	const existingFirstDetectedAt = product?.fishbowlIntake?.firstDetectedAt || now;
	const changeSummary = buildChangeSummary(product, normalized);

	product.fishbowlIntake = {
		...(product.fishbowlIntake?.toObject?.() || product.fishbowlIntake || {}),
		status: "changed",
		changeType: "fishbowl-source-changed",
		firstDetectedAt: existingFirstDetectedAt,
		lastDetectedAt: now,
		lastReviewedAt: null,
		sourceHash: previousHash,
		previousHash,
		currentHash,
		sourcePartNumber: normalized.partNumber || product?.fishbowl?.partNum || product?.sku || "",
		pendingFishbowlSnapshot: buildHashPayload(normalized),
		changeSummary,
		detectedBy: triggeredBy || "product-intake-scan",
	};

	product.needsReview = true;
	if (!product.isPublished && product.review?.status !== "approved") {
		product.review = {
			...(product.review?.toObject?.() || product.review || {}),
			status: "needs-review",
		};
	}

	await product.save();
	return product;
}

async function baselineExistingProduct({ productId, normalized, hash }) {
	await Product.updateOne(
		{ _id: productId },
		{
			$set: {
				"fishbowlIntake.sourceHash": hash,
				"fishbowlIntake.currentHash": hash,
				"fishbowlIntake.sourcePartNumber": normalized.partNumber || "",
				"sourceHashes.fishbowlHash": hash,
			},
			$setOnInsert: {},
		},
	);
}

export function getFishbowlProductIntakeRuntimeState() {
	return { ...runtimeState };
}

export async function markFishbowlIntakeReviewed(productId, userId = null) {
	const product = await Product.findById(productId);
	if (!product) throw new Error("Product not found");

	const intake = product.fishbowlIntake?.toObject?.() || product.fishbowlIntake || {};
	const currentHash = clean(intake.currentHash || intake.sourceHash || product?.sourceHashes?.fishbowlHash || "");

	product.fishbowlIntake = {
		...intake,
		status: "reviewed",
		lastReviewedAt: new Date(),
		reviewedBy: userId || null,
		sourceHash: currentHash,
		previousHash: intake.previousHash || "",
		currentHash,
	};

	product.sourceHashes = {
		...(product.sourceHashes?.toObject?.() || product.sourceHashes || {}),
		fishbowlHash: currentHash,
	};

	await product.save();
	return product;
}

export async function runFishbowlProductIntakeScan({
	mode = "all",
	dryRun = false,
	samples = true,
	limit = 0,
	pageLimit = 0,
	pageSize = Number(process.env.FISHBOWL_PRODUCT_INTAKE_PAGE_SIZE || 100),
	partsPath = process.env.FISHBOWL_PRODUCT_INTAKE_PARTS_PATH || DEFAULT_FISHBOWL_PARTS_PATH,
	activeOnly = boolEnv("FISHBOWL_PRODUCT_INTAKE_ACTIVE_ONLY", true),
	skipCleanupCandidates = boolEnv("FISHBOWL_PRODUCT_INTAKE_SKIP_CLEANUP", true),
	autoEnrichNewProducts = process.env.FISHBOWL_PRODUCT_INTAKE_AUTO_ENRICH_NEW !== "false",
	triggeredBy = "manual",
	persistRun = true,
} = {}) {
	if (runtimeState.running) {
		const err = new Error("Fishbowl product intake scan is already running");
		err.code = "FISHBOWL_PRODUCT_INTAKE_RUNNING";
		throw err;
	}

	const normalizedMode = ["new", "changed", "all"].includes(String(mode).toLowerCase())
		? String(mode).toLowerCase()
		: "all";
	const startedAt = new Date();
	const sampleRows = [];
	const now = new Date();

	runtimeState = {
		...runtimeState,
		running: true,
		startedAt,
		lastError: null,
	};

	let syncRun = null;
	if (persistRun) {
		syncRun = await SyncRun.create({
			jobType: PRODUCT_INTAKE_JOB_TYPE,
			status: "running",
			startedAt,
			stats: { found: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
			metadata: {
				mode: normalizedMode,
				dryRun,
				partsPath,
				pageSize,
				pageLimit: pageLimit || "all",
				limit: limit || "all",
				activeOnly,
				skipCleanupCandidates,
				triggeredBy,
			},
			errors: [],
			notes: "Fishbowl product intake scan",
		});
	}

	const stats = {
		mode: normalizedMode,
		dryRun,
		fishbowlRowsFetched: 0,
		fishbowlRowsChecked: 0,
		pagesRequested: 0,
		pagesFailed: 0,
		newFound: 0,
		created: 0,
		newEnriched: 0,
		changedFound: 0,
		changedFlagged: 0,
		baselinedExisting: 0,
		unchangedExisting: 0,
		existingSkippedByMode: 0,
		newSkippedByMode: 0,
		alreadyPending: 0,
		rowsWithoutPartNumber: 0,
		skippedInactive: 0,
		skippedCleanupCandidate: 0,
		failed: 0,
	};

	try {
		const fetchResult = await fetchFishbowlPartRows({
			partsPath,
			pageSize,
			pageLimit,
			rowLimit: limit,
			activeOnly,
		});

		stats.pagesRequested = fetchResult.pagesRequested;
		stats.pagesFailed = fetchResult.pagesFailed;
		stats.fishbowlRowsFetched = fetchResult.rows.length;

		const products = await Product.find(
			{},
			{
				_id: 1,
				sku: 1,
				internalPartNumber: 1,
				fishbowl: 1,
				sourceHashes: 1,
				fishbowlIntake: 1,
				review: 1,
				isPublished: 1,
				catalogStatus: 1,
			},
		).lean();

		const existingMaps = buildExistingProductMaps(products);

		for (const rawRow of fetchResult.rows) {
			const normalized = normalizeFishbowlPartRow(rawRow);
			const partKey = normalizePartKey(normalized.partNumber);

			if (!partKey) {
				stats.rowsWithoutPartNumber += 1;
				continue;
			}

			const skipResult = shouldSkipFishbowlPartRow(normalized, {
				activeOnly,
				skipCleanupCandidates,
			});

			if (skipResult.skip) {
				if (skipResult.reason === "inactive") stats.skippedInactive += 1;
				else if (skipResult.reason === "cleanup-candidate") stats.skippedCleanupCandidate += 1;

				if (samples && sampleRows.length < 10) {
					sampleRows.push({
						type: "skipped-fishbowl-row",
						reason: skipResult.reason,
						partNumber: normalized.partNumber,
						description: normalized.description,
						active: normalized.active,
					});
				}
				continue;
			}

			stats.fishbowlRowsChecked += 1;

			const hashPayload = buildHashPayload(normalized);
			const currentHash = makeHash(hashPayload);
			const existing =
				existingMaps.byPartNumber.get(partKey) ||
				(normalized.partId ? existingMaps.byPartId.get(String(normalized.partId)) : null);

			if (!existing) {
				if (normalizedMode === "changed") {
					stats.newSkippedByMode += 1;
					continue;
				}

				stats.newFound += 1;
				if (samples && sampleRows.length < 30) {
					sampleRows.push({
						type: "new-product",
						partNumber: normalized.partNumber,
						description: normalized.description,
						active: normalized.active,
						dryRun,
					});
				}

				if (dryRun) continue;

				try {
					const result = await upsertProductFromFishbowl(buildUpsertPayload(normalized));
					const product = result?.product;
					if (product) {
						await markProductAsNewIntake({ product, normalized, hash: currentHash, now, triggeredBy });

						if (autoEnrichNewProducts) {
							try {
								const enrichmentResult = await ensureNewProductEnrichment(product);
								if (["created", "updated", "existing"].includes(enrichmentResult?.action)) {
									stats.newEnriched += enrichmentResult.action === "created" ? 1 : 0;
								}
							} catch (err) {
								stats.failed += 1;
								if (syncRun) {
									syncRun.errors.push({ key: normalized.partNumber, message: `Created product, but enrichment failed: ${err.message}`, payload: null });
								}
							}
						}
						stats.created += 1;
					}
				} catch (err) {
					stats.failed += 1;
					if (syncRun) {
						syncRun.errors.push({ key: normalized.partNumber, message: err.message, payload: rawRow });
					}
				}

				continue;
			}

			if (normalizedMode === "new") {
				stats.existingSkippedByMode += 1;
				continue;
			}

			if (isPendingIntake(existing)) {
				stats.alreadyPending += 1;
				continue;
			}

			const baselineHash = getStoredBaselineHash(existing);
			if (!baselineHash) {
				stats.baselinedExisting += 1;
				if (!dryRun) {
					await baselineExistingProduct({ productId: existing._id, normalized, hash: currentHash });
				}
				continue;
			}

			if (baselineHash === currentHash) {
				stats.unchangedExisting += 1;
				continue;
			}

			stats.changedFound += 1;
			if (samples && sampleRows.length < 30) {
				const changeSummary = buildChangeSummary(existing, normalized);
				sampleRows.push({
					type: "changed-product",
					partNumber: normalized.partNumber,
					previousHash: baselineHash,
					currentHash,
					changes: changeSummary,
					dryRun,
				});
			}

			if (!dryRun) {
				await flagExistingProductChange({
					productId: existing._id,
					normalized,
					previousHash: baselineHash,
					currentHash,
					now,
					triggeredBy,
				});
				stats.changedFlagged += 1;
			}
		}

		if (syncRun) {
			syncRun.stats = {
				found: stats.fishbowlRowsChecked,
				created: stats.created,
				updated: stats.changedFlagged + stats.baselinedExisting,
				skipped:
					stats.existingSkippedByMode +
					stats.newSkippedByMode +
					stats.unchangedExisting +
					stats.alreadyPending +
					stats.skippedInactive +
					stats.skippedCleanupCandidate,
				failed: stats.failed + stats.pagesFailed,
			};
			syncRun.metadata = {
				...(syncRun.metadata || {}),
				intakeSummary: stats,
				samples: sampleRows,
			};
			syncRun.status = stats.failed || stats.pagesFailed ? "partial" : "success";
			syncRun.finishedAt = new Date();
			syncRun.durationMs = syncRun.finishedAt.getTime() - startedAt.getTime();
			await syncRun.save();
		}

		const result = {
			ok: true,
			mode: normalizedMode,
			dryRun,
			stats,
			samples: sampleRows,
			syncRunId: syncRun?._id ? String(syncRun._id) : null,
		};

		runtimeState = {
			running: false,
			startedAt: null,
			lastFinishedAt: new Date(),
			lastResult: result,
			lastError: null,
		};

		return result;
	} catch (err) {
		if (syncRun) {
			syncRun.status = "failed";
			syncRun.finishedAt = new Date();
			syncRun.durationMs = syncRun.finishedAt.getTime() - startedAt.getTime();
			syncRun.errors.push({ key: "product-intake-scan", message: err.message, payload: null });
			await syncRun.save();
		}

		runtimeState = {
			running: false,
			startedAt: null,
			lastFinishedAt: new Date(),
			lastResult: null,
			lastError: err.message,
		};

		throw err;
	}
}

export default runFishbowlProductIntakeScan;
