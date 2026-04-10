// import Product from "../../models/Product.js";
// import VendorOffering from "../../models/VendorOffering.js";

// function asString(value, fallback = "") {
//   if (value === null || value === undefined) return fallback;
//   return String(value).trim();
// }

// function asNumber(value, fallback = 0) {
//   const num = Number(value);
//   return Number.isFinite(num) ? num : fallback;
// }

// export async function createVendorOffering(input = {}) {
//   const productId = asString(input.productId);
//   const vendorName = asString(input.vendorName);
//   const vendorPartNumber = asString(input.vendorPartNumber);

//   if (!productId) {
//     throw new Error("productId is required");
//   }

//   if (!vendorName) {
//     throw new Error("vendorName is required");
//   }

//   const product = await Product.findById(productId);

//   if (!product) {
//     throw new Error("Product not found");
//   }

//   const existing = await VendorOffering.findOne({
//     productId,
//     vendorName,
//     vendorPartNumber,
//   });

//   if (existing) {
//     return {
//       action: "exists",
//       offering: existing,
//       product,
//     };
//   }

//   if (input.isPreferred === true) {
//     await VendorOffering.updateMany(
//       { productId, isPreferred: true },
//       { $set: { isPreferred: false } }
//     );
//   }

//   const offering = await VendorOffering.create({
//     productId: product._id,

//     vendorName,
//     brandName: asString(input.brandName || vendorName),

//     vendorPartNumber,
//     vendorAltPartNumbers: Array.isArray(input.vendorAltPartNumbers)
//       ? input.vendorAltPartNumbers
//       : [],

//     fishbowlPartId: asString(input.fishbowlPartId || product?.fishbowl?.partId),
//     fishbowlPartNum: asString(input.fishbowlPartNum || product?.fishbowl?.partNum),
//     internalPartNumber: asString(
//       input.internalPartNumber || product?.internalPartNumber
//     ),
//     websiteSku: asString(input.websiteSku || product?.sku),

//     vendorDescription: asString(input.vendorDescription),
//     vendorCategory: asString(input.vendorCategory),

//     inventory: {
//       qtyAvailable: asNumber(input.qtyAvailable, 0),
//       qtyOnHand: asNumber(input.qtyOnHand, 0),
//       qtyOnOrder: asNumber(input.qtyOnOrder, 0),
//       qtyAllocated: asNumber(input.qtyAllocated, 0),
//       lastSyncedAt: input.lastSyncedAt || new Date(),
//     },

//     pricing: {
//       cost:
//         input.cost === null || input.cost === undefined
//           ? null
//           : asNumber(input.cost, 0),
//       price:
//         input.price === null || input.price === undefined
//           ? null
//           : asNumber(input.price, 0),
//       currency: asString(input.currency, "USD"),
//       priceSource: asString(input.priceSource || "manual"),
//       lastSyncedAt: input.lastSyncedAt || new Date(),
//     },

//     leadTimeDays:
//       input.leadTimeDays === null || input.leadTimeDays === undefined
//         ? null
//         : asNumber(input.leadTimeDays, 0),

//     minOrderQty: asNumber(input.minOrderQty, 1),
//     packQty: asNumber(input.packQty, 1),

//     isActive: typeof input.isActive === "boolean" ? input.isActive : true,
//     isPreferred:
//       typeof input.isPreferred === "boolean" ? input.isPreferred : false,
//     isSelectableByCustomer:
//       typeof input.isSelectableByCustomer === "boolean"
//         ? input.isSelectableByCustomer
//         : false,

//     approvalStatus: asString(input.approvalStatus || "draft"),
//     matchMethod: asString(input.matchMethod || "manual"),
//     confidenceScore: asNumber(input.confidenceScore, 100),

//     notes: asString(input.notes),
//     feedData: input.feedData ?? null,
//   });

//   return {
//     action: "created",
//     offering,
//     product,
//   };
// }

// export default createVendorOffering;