import { createContext, useContext, useState, useMemo } from "react";
import skuData from "../data/product-skus.json";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

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
    setItems((prev) =>
      prev.map((i) =>
        i.partNumber === partNumber
          ? { ...i, quantity }
          : i
      )
    );
  };

  const clearCart = () => setItems([]);

  // Attach SKU details + price
  const detailedItems = useMemo(() => {
    return items.map((item) => {
      const sku = skuData.find(
        (s) => s.partNumber === item.partNumber
      );

      return {
        ...item,
        sku,
        lineTotal: sku
          ? sku.price * item.quantity
          : 0
      };
    });
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
        cartTotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
