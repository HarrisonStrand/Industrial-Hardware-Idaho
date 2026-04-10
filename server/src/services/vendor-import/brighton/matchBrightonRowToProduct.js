// import Product from "../../../models/Product.js";
// import VendorMapping from "../../../models/VendorMapping.js";
// import parseFastenerAttributes from "../../../utils/parseFastenerAttributes.js";

// function normalize(value = "") {
// 	return String(value || "").trim().toLowerCase();
// }

// function escapeRegex(value = "") {
// 	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// function same(a, b) {
// 	return normalize(a) && normalize(a) === normalize(b);
// }

// function containsWord(haystack = "", needle = "") {
// 	const h = normalize(haystack);
// 	const n = normalize(needle);
// 	return !!h && !!n && h.includes(n);
// }

// function scoreCandidate(product, parsed, vendorDescription = "") {
// 	const p = product?.fishbowl?.raw?.parsedAttributes || {};
// 	let score = 0;
// 	const reasons = [];

// 	if (same(p.size, parsed.size)) {
// 		score += 35;
// 		reasons.push("size");
// 	}

// 	if (same(p.diameter, parsed.diameter)) {
// 		score += 20;
// 		reasons.push("diameter");
// 	}

// 	if (same(p.threadPitch, parsed.threadPitch)) {
// 		score += 15;
// 		reasons.push("threadPitch");
// 	}

// 	if (same(p.length, parsed.length)) {
// 		score += 15;
// 		reasons.push("length");
// 	}

// 	if (same(p.fastenerType, parsed.fastenerType)) {
// 		score += 25;
// 		reasons.push("fastenerType");
// 	}

// 	if (same(p.finish, parsed.finish)) {
// 		score += 15;
// 		reasons.push("finish");
// 	}

// 	if (same(p.grade, parsed.grade)) {
// 		score += 10;
// 		reasons.push("grade");
// 	}

// 	if (same(p.material, parsed.material)) {
// 		score += 10;
// 		reasons.push("material");
// 	}

// 	if (same(p.measurementSystem, parsed.measurementSystem)) {
// 		score += 8;
// 		reasons.push("measurementSystem");
// 	}

// 	// bonus scoring from raw description text
// 	if (p.fastenerType && containsWord(vendorDescription, p.fastenerType)) {
// 		score += 10;
// 		reasons.push("desc-fastenerType");
// 	}

// 	if (p.finish && containsWord(vendorDescription, p.finish)) {
// 		score += 6;
// 		reasons.push("desc-finish");
// 	}

// 	if (p.grade && containsWord(vendorDescription, p.grade)) {
// 		score += 5;
// 		reasons.push("desc-grade");
// 	}

// 	if (p.material && containsWord(vendorDescription, p.material)) {
// 		score += 4;
// 		reasons.push("desc-material");
// 	}

// 	return { product, score, reasons, parsedAttributes: p };
// }

// function buildCandidateQuery(parsed = {}, vendorDescription = "") {
// 	const or = [];

// 	if (parsed.size) {
// 		or.push({ "fishbowl.raw.parsedAttributes.size": parsed.size });
// 	}

// 	if (parsed.fastenerType) {
// 		or.push({ "fishbowl.raw.parsedAttributes.fastenerType": parsed.fastenerType });
// 	}

// 	if (parsed.diameter) {
// 		or.push({ "fishbowl.raw.parsedAttributes.diameter": parsed.diameter });
// 	}

// 	if (parsed.length) {
// 		or.push({ "fishbowl.raw.parsedAttributes.length": parsed.length });
// 	}

// 	if (parsed.grade) {
// 		or.push({ "fishbowl.raw.parsedAttributes.grade": parsed.grade });
// 	}

// 	if (parsed.finish) {
// 		or.push({ "fishbowl.raw.parsedAttributes.finish": parsed.finish });
// 	}

// 	if (or.length > 0) {
// 		return { $or: or };
// 	}

// 	if (vendorDescription) {
// 		return {
// 			$or: [
// 				{ "fishbowl.description": new RegExp(escapeRegex(vendorDescription), "i") },
// 				{ sku: new RegExp(escapeRegex(vendorDescription), "i") },
// 			],
// 		};
// 	}

// 	return null;
// }

// export async function matchBrightonRowToProduct(normalizedRow = {}) {
// 	const vendorPartNumber = normalizedRow.vendorPartNumber || "";
// 	const vendorDescription = normalizedRow.vendorDescription || "";

// 	// 1. Existing approved mapping
// 	if (vendorPartNumber) {
// 		const existingMapping = await VendorMapping.findOne({
// 			vendorName: "Brighton Best",
// 			vendorPartNumber,
// 			approved: true,
// 		});

// 		if (existingMapping) {
// 			return {
// 				matched: true,
// 				matchMethod: "exact-part-number",
// 				confidenceScore: 100,
// 				productId: existingMapping.productId,
// 				vendorMappingId: existingMapping._id,
// 				reason: "Matched existing approved Brighton part mapping",
// 			};
// 		}
// 	}

// 	// 2. Internal / website SKU direct match
// 	const possibleInternal = normalize(
// 		normalizedRow.internalPartNumber || normalizedRow.websiteSku || ""
// 	);

// 	if (possibleInternal) {
// 		const safePattern = `^${escapeRegex(possibleInternal)}$`;

// 		const internalMatch = await Product.findOne({
// 			$or: [
// 				{ sku: new RegExp(safePattern, "i") },
// 				{ internalPartNumber: new RegExp(safePattern, "i") },
// 				{ "fishbowl.partNum": new RegExp(safePattern, "i") },
// 			],
// 		});

// 		if (internalMatch) {
// 			return {
// 				matched: true,
// 				matchMethod: "manual",
// 				confidenceScore: 95,
// 				productId: internalMatch._id,
// 				vendorMappingId: null,
// 				reason: "Matched supplied internal SKU/internal part number",
// 			};
// 		}
// 	}

// 	// 3. Direct vendor part number to internal part number
// 	if (vendorPartNumber) {
// 		const safePattern = `^${escapeRegex(vendorPartNumber)}$`;

// 		const directPartMatch = await Product.findOne({
// 			$or: [
// 				{ "fishbowl.partNum": new RegExp(safePattern, "i") },
// 				{ sku: new RegExp(safePattern, "i") },
// 				{ internalPartNumber: new RegExp(safePattern, "i") },
// 			],
// 		});

// 		if (directPartMatch) {
// 			return {
// 				matched: true,
// 				matchMethod: "exact-part-number",
// 				confidenceScore: 97,
// 				productId: directPartMatch._id,
// 				vendorMappingId: null,
// 				reason: "Matched vendor part number directly to Fishbowl/internal part number",
// 			};
// 		}
// 	}

// 	// 4. Description/spec matching
// 	if (vendorDescription) {
// 		const parsed = parseFastenerAttributes(vendorDescription);
// 		const candidateQuery = buildCandidateQuery(parsed, vendorDescription);

// 		if (candidateQuery) {
// 			const candidates = await Product.find(candidateQuery).limit(75);

// 			const scored = candidates
// 				.map((product) => scoreCandidate(product, parsed, vendorDescription))
// 				.filter((entry) => entry.score > 0)
// 				.sort((a, b) => b.score - a.score);

// 			const best = scored[0];
// 			const second = scored[1];
// 			const separation = best
// 				? second
// 					? best.score - second.score
// 					: best.score
// 				: 0;

// 			if (best && best.score >= 85 && separation >= 8) {
// 				return {
// 					matched: true,
// 					matchMethod: "description-match",
// 					confidenceScore: best.score,
// 					productId: best.product._id,
// 					vendorMappingId: null,
// 					reason: `Matched by parsed specification similarity (${best.reasons.join(", ")})`,
// 				};
// 			}

// 			if (best && best.score >= 60) {
// 				return {
// 					matched: false,
// 					matchMethod: "description-match",
// 					confidenceScore: best.score,
// 					productId: best.product._id,
// 					vendorMappingId: null,
// 					reason: `Possible match found but needs review (${best.reasons.join(", ")})`,
// 				};
// 			}
// 		}
// 	}

// 	return {
// 		matched: false,
// 		matchMethod: "unknown",
// 		confidenceScore: 0,
// 		productId: null,
// 		vendorMappingId: null,
// 		reason: "No reliable Brighton match found",
// 	};
// }

// export default matchBrightonRowToProduct;