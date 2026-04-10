function asNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function roundMoney(value) {
	return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getPricingTier(user = null) {
	if (!user) return "retail";

	if (user?.pricingTier) {
		return user.pricingTier;
	}

	if (user?.accountType === "net30") return "net30";
	if (user?.accountType === "in-house") return "inHouse";

	return "retail";
}

export function resolveCatalogPrice({
	product = null,
	user = null,
	quantity = 1,
	context = "catalog",
} = {}) {
	if (!product) {
		return {
			unitPrice: 0,
			subtotal: 0,
			currency: "USD",
			tier: "retail",
			priceSource: "none",
			basePrice: 0,
			adjustments: [],
			context,
		};
	}

	const currency = product?.pricing?.currency || "USD";
	const basePrice = asNumber(
		product?.pricing?.basePrice ?? product?.pricing?.salePrice ?? 0,
		0
	);

	const tier = getPricingTier(user);
	const adjustments = [];

	let multiplier = 1;

	// Starter pricing rules
	if (tier === "inHouse") {
		multiplier = 0.95;
		adjustments.push({
			type: "tier-discount",
			label: "Approved in-house account",
			value: -5,
			valueType: "percent",
		});
	}

	if (tier === "net30") {
		multiplier = 0.9;
		adjustments.push({
			type: "tier-discount",
			label: "Net 30 pricing",
			value: -10,
			valueType: "percent",
		});
	}

	// Optional starter quantity break
	if (Number(quantity) >= 100) {
		multiplier *= 0.98;
		adjustments.push({
			type: "quantity-discount",
			label: "100+ quantity break",
			value: -2,
			valueType: "percent",
		});
	}

	const unitPrice = roundMoney(basePrice * multiplier);
	const subtotal = roundMoney(unitPrice * Math.max(1, asNumber(quantity, 1)));

	return {
		unitPrice,
		subtotal,
		currency,
		tier,
		priceSource: "product.pricing.basePrice",
		basePrice,
		adjustments,
		context,
	};
}

export default resolveCatalogPrice;