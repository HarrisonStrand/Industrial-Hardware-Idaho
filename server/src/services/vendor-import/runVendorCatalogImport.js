import SyncRun from "../../models/SyncRun.js";
import createVendorOffering from "../catalog/createVendorOffering.js";
import createVendorMapping from "../catalog/createVendorMapping.js";
import attachStoredVendorImageToProduct from "../catalog/attachStoredVendorImageToProduct.js";

export async function runVendorCatalogImport({
	vendorName,
	rows = [],
	normalizeRow,
	matchRowToProduct,
}) {
	if (!vendorName) {
		throw new Error("vendorName is required");
	}

	if (!Array.isArray(rows)) {
		throw new Error("rows must be an array");
	}

	if (typeof normalizeRow !== "function") {
		throw new Error("normalizeRow must be a function");
	}

	if (typeof matchRowToProduct !== "function") {
		throw new Error("matchRowToProduct must be a function");
	}

	const syncRun = await SyncRun.create({
		jobType: "vendor-brighton-import",
		status: "running",
		startedAt: new Date(),
		stats: {
			found: rows.length,
			created: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
		},
		errors: [],
		notes: `${vendorName} catalog import run`,
	});

	try {
		const results = [];

		for (const rawRow of rows) {
			try {
				const normalizedRow = normalizeRow(rawRow);

				if (!normalizedRow.vendorPartNumber) {
					throw new Error("Normalized row is missing vendorPartNumber");
				}

				const match = await matchRowToProduct(normalizedRow);

				if (!match.productId) {
					syncRun.stats.skipped += 1;
					results.push({
						status: "unmatched",
						normalizedRow,
						match,
					});
					continue;
				}

				const offeringResult = await createVendorOffering({
					productId: match.productId,
					vendorName: normalizedRow.vendorName,
					brandName: normalizedRow.manufacturerName || normalizedRow.vendorName,
					vendorPartNumber: normalizedRow.vendorPartNumber,
					vendorAltPartNumbers: normalizedRow.vendorAltPartNumbers || [],
					vendorDescription: normalizedRow.vendorDescription,
					vendorCategory: normalizedRow.vendorCategory,
					qtyAvailable: normalizedRow.qtyAvailable,
					qtyOnHand: normalizedRow.qtyOnHand,
					qtyOnOrder: normalizedRow.qtyOnOrder,
					qtyAllocated: normalizedRow.qtyAllocated,
					cost: normalizedRow.cost,
					price: normalizedRow.price,
					currency: normalizedRow.currency || "USD",
					priceSource: "vendor-feed",
					leadTimeDays: normalizedRow.leadTimeDays,
					isPreferred: false,
					isSelectableByCustomer: false,
					approvalStatus: match.matched ? "approved" : "draft",
					matchMethod: match.matchMethod,
					confidenceScore: match.confidenceScore,
					notes: match.reason,
					feedData: normalizedRow.raw,
				});

				const mappingResult = await createVendorMapping({
					productId: match.productId,
					vendorOfferingId: offeringResult.offering._id,
					vendorName: normalizedRow.vendorName,
					manufacturerName:
						normalizedRow.manufacturerName || normalizedRow.vendorName,
					vendorPartNumber: normalizedRow.vendorPartNumber,
					vendorAltPartNumbers: normalizedRow.vendorAltPartNumbers || [],
					vendorCategory: normalizedRow.vendorCategory,
					vendorDescription: normalizedRow.vendorDescription,
					matchMethod: match.matchMethod,
					confidenceScore: match.confidenceScore,
					approved: match.matched,
					needsReview: !match.matched,
					isPrimaryMapping: !!match.matched,
					notes: match.reason,
					feedData: normalizedRow.raw,
				});

				let imageResult = null;

				if (normalizedRow.imageUrl) {
					imageResult = await attachStoredVendorImageToProduct({
						productId: match.productId,
						imageUrl: normalizedRow.imageUrl,
						vendorName: normalizedRow.vendorName,
						vendorPartNumber: normalizedRow.vendorPartNumber,
					});
				}

				if (
					offeringResult.action === "created" ||
					mappingResult.action === "created"
				) {
					syncRun.stats.created += 1;
				} else {
					syncRun.stats.updated += 1;
				}

				results.push({
					status: match.matched ? "matched" : "review",
					normalizedRow,
					match,
					offeringId: offeringResult.offering._id,
					mappingId: mappingResult.mapping._id,
					imageAction: imageResult?.action || null,
				});
			} catch (error) {
				syncRun.stats.failed += 1;
				syncRun.errors.push({
					key: rawRow?.vendorPartNumber || rawRow?.partNumber || "unknown-row",
					message: error.message,
					payload: rawRow,
				});
			}
		}

		syncRun.status = syncRun.stats.failed > 0 ? "partial" : "success";

		syncRun.finishedAt = new Date();
		await syncRun.save();

		return {
			syncRun,
			results,
		};
	} catch (error) {
		syncRun.status = "failed";
		syncRun.finishedAt = new Date();
		syncRun.errors.push({
			key: "vendor-import",
			message: error.message,
			payload: null,
		});
		await syncRun.save();
		throw error;
	}
}

export default runVendorCatalogImport;
