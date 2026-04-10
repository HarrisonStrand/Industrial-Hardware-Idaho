// import Product from "../../models/Product.js";
// import VendorOffering from "../../models/VendorOffering.js";

// function asNumber(value, fallback = 0) {
//   const num = Number(value);
//   return Number.isFinite(num) ? num : fallback;
// }

// function safeLeadTime(value) {
//   if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;
//   const num = Number(value);
//   return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
// }

// function safeCost(value) {
//   if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;
//   const num = Number(value);
//   return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
// }

// function sortInStockOfferings(a, b) {
//   const aPreferred = a.isPreferred ? 1 : 0;
//   const bPreferred = b.isPreferred ? 1 : 0;

//   if (aPreferred !== bPreferred) {
//     return bPreferred - aPreferred;
//   }

//   const aCost = safeCost(a?.pricing?.cost);
//   const bCost = safeCost(b?.pricing?.cost);

//   if (aCost !== bCost) {
//     return aCost - bCost;
//   }

//   const aLead = safeLeadTime(a?.leadTimeDays);
//   const bLead = safeLeadTime(b?.leadTimeDays);

//   if (aLead !== bLead) {
//     return aLead - bLead;
//   }

//   const aQty = asNumber(a?.inventory?.qtyAvailable, 0);
//   const bQty = asNumber(b?.inventory?.qtyAvailable, 0);

//   return bQty - aQty;
// }

// function sortFallbackOfferings(a, b) {
//   const aPreferred = a.isPreferred ? 1 : 0;
//   const bPreferred = b.isPreferred ? 1 : 0;

//   if (aPreferred !== bPreferred) {
//     return bPreferred - aPreferred;
//   }

//   const aLead = safeLeadTime(a?.leadTimeDays);
//   const bLead = safeLeadTime(b?.leadTimeDays);

//   if (aLead !== bLead) {
//     return aLead - bLead;
//   }

//   const aCost = safeCost(a?.pricing?.cost);
//   const bCost = safeCost(b?.pricing?.cost);

//   if (aCost !== bCost) {
//     return aCost - bCost;
//   }

//   return 0;
// }

// export async function selectVendorOfferingForProduct(productId) {
//   if (!productId) {
//     throw new Error("productId is required");
//   }

//   const product = await Product.findById(productId);

//   if (!product) {
//     throw new Error("Product not found");
//   }

//   const offerings = await VendorOffering.find({
//     productId,
//     isActive: true,
//     approvalStatus: "approved",
//   }).lean();

//   if (!offerings.length) {
//     return {
//       status: "no-offerings",
//       product,
//       selectedOffering: null,
//       reason: "No approved active vendor offerings found",
//       inStockOfferings: [],
//       fallbackOfferings: [],
//     };
//   }

//   const inStockOfferings = offerings.filter(
//     (offering) => asNumber(offering?.inventory?.qtyAvailable, 0) > 0
//   );

//   if (inStockOfferings.length > 0) {
//     const sorted = [...inStockOfferings].sort(sortInStockOfferings);
//     const selectedOffering = sorted[0];

//     let reason = "Selected lowest-cost in-stock vendor offering";
//     if (selectedOffering.isPreferred) {
//       reason = "Selected preferred in-stock vendor offering";
//     }

//     return {
//       status: "selected-in-stock",
//       product,
//       selectedOffering,
//       reason,
//       inStockOfferings: sorted,
//       fallbackOfferings: [],
//     };
//   }

//   const fallbackOfferings = [...offerings].sort(sortFallbackOfferings);
//   const selectedOffering = fallbackOfferings[0];

//   return {
//     status: "selected-fallback",
//     product,
//     selectedOffering,
//     reason: "No in-stock vendor offering found; selected best fallback offering",
//     inStockOfferings: [],
//     fallbackOfferings,
//   };
// }

// export default selectVendorOfferingForProduct;