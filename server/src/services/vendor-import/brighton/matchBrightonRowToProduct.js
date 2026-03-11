import Product from "../../../models/Product.js";
import VendorMapping from "../../../models/VendorMapping.js";
import parseFastenerAttributes from "../../../utils/parseFastenerAttributes.js";

function normalize(value = "") {
	return String(value).trim().toLowerCase();
}

export async function matchBrightonRowToProduct(normalizedRow = {}) {
	const vendorPartNumber = normalizedRow.vendorPartNumber || "";
	const vendorDescription = normalizedRow.vendorDescription || "";

	// 1. Exact existing vendor mapping by Brighton part number
	if (vendorPartNumber) {
		const existingMapping = await VendorMapping.findOne({
			vendorName: "Brighton Best",
			vendorPartNumber,
			approved: true,
		});

		if (existingMapping) {
			return {
				matched: true,
				matchMethod: "exact-part-number",
				confidenceScore: 100,
				productId: existingMapping.productId,
				vendorMappingId: existingMapping._id,
				reason: "Matched existing approved Brighton part mapping",
			};
		}
	}

	// 2. Try exact Fishbowl/internal SKU fields if vendor row happens to contain them later
	const possibleInternal = normalize(
		normalizedRow.internalPartNumber || normalizedRow.websiteSku || "",
	);

	if (possibleInternal) {
		const internalMatch = await Product.findOne({
			$or: [
				{ sku: new RegExp(`^${possibleInternal}$`, "i") },
				{ internalPartNumber: new RegExp(`^${possibleInternal}$`, "i") },
			],
		});

		if (internalMatch) {
			return {
				matched: true,
				matchMethod: "manual",
				confidenceScore: 95,
				productId: internalMatch._id,
				vendorMappingId: null,
				reason: "Matched supplied internal SKU/internal part number",
			};
		}
	}

	// 3. Spec/description-based match using parsed attributes
	if (vendorDescription) {
		const parsed = parseFastenerAttributes(vendorDescription);

		if (parsed.size && parsed.fastenerType) {
			const candidates = await Product.find({
				"fishbowl.raw.parsedAttributes.size": parsed.size,
				"fishbowl.raw.parsedAttributes.fastenerType": parsed.fastenerType,
			}).limit(25);

			const scored = candidates.map((product) => {
				const p = product?.fishbowl?.raw?.parsedAttributes || {};

				let score = 0;
				if (normalize(p.size) === normalize(parsed.size)) score += 35;
				if (normalize(p.fastenerType) === normalize(parsed.fastenerType))
					score += 30;
				if (normalize(p.finish) === normalize(parsed.finish)) score += 15;
				if (normalize(p.grade) === normalize(parsed.grade)) score += 10;
				if (normalize(p.length) === normalize(parsed.length)) score += 10;

				return { product, score };
			});

			scored.sort((a, b) => b.score - a.score);

			const best = scored[0];

			if (best && best.score >= 70) {
				return {
					matched: true,
					matchMethod: "description-match",
					confidenceScore: best.score,
					productId: best.product._id,
					vendorMappingId: null,
					reason: "Matched by parsed specification similarity",
				};
			}

			if (best && best.score >= 45) {
				return {
					matched: false,
					matchMethod: "description-match",
					confidenceScore: best.score,
					productId: best.product._id,
					vendorMappingId: null,
					reason: "Possible match found but needs review",
				};
			}
		}
	}

	return {
		matched: false,
		matchMethod: "unknown",
		confidenceScore: 0,
		productId: null,
		vendorMappingId: null,
		reason: "No reliable Brighton match found",
	};
}

export default matchBrightonRowToProduct;
