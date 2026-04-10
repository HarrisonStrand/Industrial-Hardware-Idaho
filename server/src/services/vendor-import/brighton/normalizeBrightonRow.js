// function asString(value, fallback = "") {
//   if (value === null || value === undefined) return fallback;
//   return String(value).trim();
// }

// function asNumber(value, fallback = 0) {
//   const num = Number(value);
//   return Number.isFinite(num) ? num : fallback;
// }

// export function normalizeBrightonRow(row = {}) {
//   return {
//     vendorName: "Brighton Best",
//     manufacturerName: "Brighton Best",

//     vendorPartNumber: asString(
//       row.vendorPartNumber ||
//         row.partNumber ||
//         row.part_number ||
//         row.brightonPartNumber ||
//         row.sku
//     ),

//     vendorAltPartNumbers: Array.isArray(row.vendorAltPartNumbers)
//       ? row.vendorAltPartNumbers
//       : [],

//     vendorDescription: asString(
//       row.vendorDescription ||
//         row.description ||
//         row.productDescription ||
//         row.name
//     ),

//     vendorCategory: asString(
//       row.vendorCategory ||
//         row.category ||
//         row.productCategory
//     ),

//     // add these so the matcher can lock onto the intended product
//     internalPartNumber: asString(row.internalPartNumber || ""),
//     websiteSku: asString(row.websiteSku || row.sku || ""),

//     qtyAvailable: asNumber(row.qtyAvailable ?? row.availableQty ?? row.available, 0),
//     qtyOnHand: asNumber(row.qtyOnHand ?? row.onHandQty ?? row.onHand, 0),
//     qtyOnOrder: asNumber(row.qtyOnOrder ?? row.onOrderQty ?? row.onOrder, 0),
//     qtyAllocated: asNumber(row.qtyAllocated ?? row.allocatedQty ?? row.allocated, 0),

//     cost:
//       row.cost === null || row.cost === undefined
//         ? null
//         : asNumber(row.cost, 0),

//     price:
//       row.price === null || row.price === undefined
//         ? null
//         : asNumber(row.price, 0),

//     currency: asString(row.currency, "USD"),

//     leadTimeDays:
//       row.leadTimeDays === null || row.leadTimeDays === undefined
//         ? null
//         : asNumber(row.leadTimeDays, 0),

//     imageUrl: asString(row.imageUrl || row.image || row.primaryImage || ""),
//     raw: row,
//   };
// }

// export default normalizeBrightonRow;