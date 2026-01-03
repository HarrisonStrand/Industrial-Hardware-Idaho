import { createContext, useContext, useState, useMemo } from "react";
import skuData from "../data/product-skus.json";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  const addToCart = (partNumber, quantity = 1) => {
    const qty = Number(quantity || 1);

    setItems((prev) => {
      const existing = prev.find((i) => i.partNumber === partNumber);

      if (existing) {
        return prev.map((i) =>
          i.partNumber === partNumber
            ? { ...i, quantity: Number(i.quantity) + qty }
            : i
        );
      }

      return [...prev, { partNumber, quantity: qty }];
    });
  };

  const removeFromCart = (partNumber) => {
    setItems((prev) => prev.filter((i) => i.partNumber !== partNumber));
  };

  const updateQuantity = (partNumber, quantity) => {
    const qty = Number(quantity);

    setItems((prev) =>
      prev
        .map((i) =>
          i.partNumber === partNumber ? { ...i, quantity: qty } : i
        )
        .filter((i) => Number(i.quantity) > 0)
    );
  };

  const clearCart = () => setItems([]);

  const detailedItems = useMemo(() => {
    return items.map((item) => {
      const sku = skuData.find((s) => s.partNumber === item.partNumber);

      const unitPrice = Number(sku?.price ?? 0);
      const qty = Number(item.quantity ?? 0);

      return {
        ...item,
        sku,
        name: sku?.name || sku?.partNumber || item.partNumber,
        image: sku?.image || "",
        attributes: sku?.attributes || {},
        price: unitPrice,
        lineTotal: unitPrice * qty
      };
    });
  }, [items]);

  const cartTotal = useMemo(() => {
    return detailedItems.reduce(
      (sum, item) => sum + (Number(item.lineTotal) || 0),
      0
    );
  }, [detailedItems]);

  // ✅ total quantity (optional, keep if you want it elsewhere)
  const cartCount = useMemo(() => {
    return detailedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
  }, [detailedItems]);

  // ✅ distinct products (cart lines)
  const cartItemCount = useMemo(() => {
    return detailedItems.length;
  }, [detailedItems]);

  return (
    <CartContext.Provider
      value={{
        items: detailedItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        cartItemCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
