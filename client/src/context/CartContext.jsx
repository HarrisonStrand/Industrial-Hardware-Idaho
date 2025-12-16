import { createContext, useContext, useState, useMemo, useEffect } from "react";
import skuData from "../data/product-skus.json";

const CartContext = createContext({
  openCart: () => {}
});
const STORAGE_KEY = "ihid_cart";

export function CartProvider({ children, openCart }) {
  // --------------------------------------------------
  // LOAD FROM LOCAL STORAGE (ONCE)
  // --------------------------------------------------
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // --------------------------------------------------
  // SAVE TO LOCAL STORAGE (ON CHANGE)
  // --------------------------------------------------
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // --------------------------------------------------
  // CART ACTIONS
  // --------------------------------------------------
  const addToCart = (partNumber, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.partNumber === partNumber
      );

      if (existing) {
        return prev.map((i) =>
          i.partNumber === partNumber
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }

      return [...prev, { partNumber, quantity }];
    });
  };

  const removeFromCart = (partNumber) => {
    setItems((prev) =>
      prev.filter((i) => i.partNumber !== partNumber)
    );
  };

  const updateQuantity = (partNumber, quantity) => {
    if (quantity <= 0) return;

    setItems((prev) =>
      prev.map((i) =>
        i.partNumber === partNumber
          ? { ...i, quantity }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // --------------------------------------------------
  // ENRICH CART ITEMS WITH SKU DATA
  // --------------------------------------------------
  const detailedItems = useMemo(() => {
    return items
      .map((item) => {
        const sku = skuData.find(
          (s) => s.partNumber === item.partNumber
        );

        if (!sku) return null;

        return {
          ...item,
          sku,
          lineTotal: sku.price * item.quantity
        };
      })
      .filter(Boolean);
  }, [items]);

  const cartTotal = detailedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: detailedItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        openCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
