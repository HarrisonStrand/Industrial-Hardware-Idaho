// import VendorMapping from "../../models/VendorMapping.js";
// import VendorOffering from "../../models/VendorOffering.js";
// import markProductCurated from "./markProductCurated.js";

// export async function approveVendorMapping(mappingId) {
// 	if (!mappingId) {
// 		throw new Error("mappingId is required");
// 	}

// 	const mapping = await VendorMapping.findById(mappingId);
// 	if (!mapping) {
// 		throw new Error("VendorMapping not found");
// 	}

// 	mapping.approved = true;
// 	mapping.needsReview = false;
// 	mapping.isPrimaryMapping = true;
// 	await mapping.save();

// 	if (mapping.vendorOfferingId) {
// 		const offering = await VendorOffering.findById(mapping.vendorOfferingId);
// 		if (offering) {
// 			offering.approvalStatus = "approved";
// 			offering.matchMethod = mapping.matchMethod || offering.matchMethod;
// 			offering.confidenceScore = mapping.confidenceScore || offering.confidenceScore;
// 			await offering.save();
// 		}
// 	}

// 	await markProductCurated(mapping.productId, { needsReview: false });

// 	return {
// 		action: "approved",
// 		mapping,
// 	};
// }

// export async function rejectVendorMapping(mappingId) {
// 	if (!mappingId) {
// 		throw new Error("mappingId is required");
// 	}

// 	const mapping = await VendorMapping.findById(mappingId);
// 	if (!mapping) {
// 		throw new Error("VendorMapping not found");
// 	}

// 	mapping.approved = false;
// 	mapping.needsReview = false;
// 	mapping.isPrimaryMapping = false;
// 	await mapping.save();

// 	if (mapping.vendorOfferingId) {
// 		const offering = await VendorOffering.findById(mapping.vendorOfferingId);
// 		if (offering) {
// 			offering.approvalStatus = "archived";
// 			await offering.save();
// 		}
// 	}

// 	return {
// 		action: "rejected",
// 		mapping,
// 	};
// }

// export default {
// 	approveVendorMapping,
// 	rejectVendorMapping,
// };