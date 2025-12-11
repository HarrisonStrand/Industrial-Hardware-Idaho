import { createContext, useContext, useEffect, useState } from "react";

// Create React context
const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartQuantity, setCartQuantity] = useState(0);

  // ----------------------------------------
  // Load from localStorage on first render
  // ----------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem("ihi-cart");
    if (saved) {
      setCartItems(JSON.parse(saved));
    }
  }, []);

  // ----------------------------------------
  // Recalculate totals & sync localStorage
  // ----------------------------------------
  useEffect(() => {
    const quantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const total = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    setCartQuantity(quantity);
    setCartTotal(total);

    localStorage.setItem("ihi-cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // ----------------------------------------
  // Generate a SKU for attributes
  // Example: BOLT-HEX-1/4-3in-Grade8
  // ----------------------------------------
  const generateSKU = (product) => {
    const base = product.id || product.name.replace(/\s+/g, "-").toUpperCase();
    const attrs = Object.values(product.attributes || {})
      .join("-")
      .replace(/\s+/g, "-")
      .toUpperCase();

    return `${base}-${attrs}`;
  };

  // ----------------------------------------
  // Add item to cart
  // ----------------------------------------
  const addToCart = (product) => {
    const sku = generateSKU(product);

    const existing = cartItems.find((item) => item.sku === sku);

    if (existing) {
      // Increase quantity if product already exists
      setCartItems((prev) =>
        prev.map((item) =>
          item.sku === sku
            ? { ...item, quantity: item.quantity + (product.quantity || 1) }
            : item
        )
      );
    } else {
      // Add new product
      setCartItems((prev) => [
        ...prev,
        {
          ...product,
          sku,
          quantity: product.quantity || 1,
        },
      ]);
    }
  };

  // ----------------------------------------
  // Remove from cart
  // ----------------------------------------
  const removeFromCart = (sku) => {
    setCartItems((prev) => prev.filter((item) => item.sku !== sku));
  };

  // ----------------------------------------
  // Update quantity (+ or -)
  // ----------------------------------------
  const updateQuantity = (sku, newQty) => {
    if (newQty <= 0) return;

    setCartItems((prev) =>
      prev.map((item) =>
        item.sku === sku ? { ...item, quantity: newQty } : item
      )
    );
  };

  // ----------------------------------------
  // Edit attributes (diameter, length, grade, etc.)
  // Regenerates SKU to avoid mixing items
  // ----------------------------------------
  const updateAttributes = (sku, newAttributes) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;

        const updatedItem = {
          ...item,
          attributes: newAttributes,
        };

        updatedItem.sku = generateSKU(updatedItem);
        return updatedItem;
      })
    );
  };

  // ----------------------------------------
  // Clear cart
  // ----------------------------------------
  const clearCart = () => setCartItems([]);

  // ----------------------------------------
  // Provide everything to the app
  // ----------------------------------------
  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartTotal,
        cartQuantity,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateAttributes,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
