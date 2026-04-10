import { createContext, useContext, useState, useMemo } from "react";

const CartContext = createContext();

function toSafeNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function normalizeCatalogCartInput(input = {}) {
	const quantity = Math.max(1, toSafeNumber(input.quantity, 1));
	const productId = input.productId || null;

	const lineId = `catalog:${productId || input.partNumber || input.sku || "unknown"}`;

	return {
		mode: "catalog",
		lineId,
		partNumber: input.partNumber || input.sku || "",
		productId,
		sku: input.sku || "",
		slug: input.slug || "",
		name: input.name || input.title || "Product",
		image: input.image || "",
		attributes: input.attributes || {},
		price: toSafeNumber(input.price, 0),
		quantity,
		metadata: {
			source: "catalog-api",
			category: input.category || "",
			subcategory: input.subcategory || "",
			shortDescription: input.shortDescription || "",
			groupedPartNumbers: Array.isArray(input.groupedPartNumbers)
				? input.groupedPartNumbers
				: Array.isArray(input?.metadata?.groupedPartNumbers)
				? input.metadata.groupedPartNumbers
				: [],
			duplicateCount: toSafeNumber(
				input.duplicateCount ?? input?.metadata?.duplicateCount,
				1
			),
		},
	};
}

export function CartProvider({ children, openCart }) {
	const [items, setItems] = useState([]);

	const addToCart = (input = {}) => {
		const snapshot = normalizeCatalogCartInput(input);

		setItems((prev) => {
			const existing = prev.find((item) => item.lineId === snapshot.lineId);

			if (existing) {
				return prev.map((item) =>
					item.lineId === snapshot.lineId
						? {
								...item,
								quantity: Math.max(
									1,
									toSafeNumber(item.quantity, 0) +
										toSafeNumber(snapshot.quantity, 0)
								),
								price: toSafeNumber(snapshot.price, item.price ?? 0),
								image: snapshot.image || item.image || "",
								name: snapshot.name || item.name || "Product",
								attributes: snapshot.attributes || item.attributes || {},
								metadata: {
									...(item.metadata || {}),
									...(snapshot.metadata || {}),
								},
						  }
						: item
				);
			}

			return [...prev, snapshot];
		});
	};

	const removeFromCart = (lineId) => {
		setItems((prev) => prev.filter((item) => item.lineId !== lineId));
	};

	const updateQuantity = (lineId, quantity) => {
		const nextQty = Math.max(0, toSafeNumber(quantity, 0));

		setItems((prev) =>
			prev
				.map((item) =>
					item.lineId === lineId ? { ...item, quantity: nextQty } : item
				)
				.filter((item) => toSafeNumber(item.quantity, 0) > 0)
		);
	};

	const clearCart = () => setItems([]);

	const detailedItems = useMemo(() => {
		return items.map((item) => {
			const qty = toSafeNumber(item.quantity, 0);
			const unitPrice = toSafeNumber(item.price, 0);
			const lineTotal = unitPrice * qty;

			return {
				...item,
				price: unitPrice,
				quantity: qty,
				lineTotal,
			};
		});
	}, [items]);

	const cartTotal = useMemo(() => {
		return detailedItems.reduce(
			(sum, item) => sum + toSafeNumber(item.lineTotal, 0),
			0
		);
	}, [detailedItems]);

	const cartCount = useMemo(() => {
		return detailedItems.reduce(
			(sum, item) => sum + toSafeNumber(item.quantity, 0),
			0
		);
	}, [detailedItems]);

	const cartItemCount = useMemo(() => {
		return detailedItems.length;
	}, [detailedItems]);

	const openCartSafe = () => {
		if (typeof openCart === "function") openCart();
	};

	return (
		<CartContext.Provider
			value={{
				items: detailedItems,
				addToCart,
				removeFromCart,
				updateQuantity,
				clearCart,
				cartTotal,
				subtotal: cartTotal,
				cartCount,
				cartItemCount,
				openCart: openCartSafe,
			}}>
			{children}
		</CartContext.Provider>
	);
}

export function useCart() {
	return useContext(CartContext);
}