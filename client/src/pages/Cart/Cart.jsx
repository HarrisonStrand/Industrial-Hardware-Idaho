import React from "react";
import { useCart } from "../../context/CartContext.jsx";
import CartItem from "../../components/Cart/CartItem/CartItem.jsx";

export default function Cart() {
  const { cartItems, cartTotal } = useCart();

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>

      {cartItems.length === 0 && <p>Your cart is empty.</p>}

      <div className="cart-list">
        {cartItems.map(item => (
          <CartItem key={item.id + item.sku} item={item} detailed />
        ))}
      </div>

      <div className="cart-summary">
        <h3>Order Summary</h3>
        <p>Subtotal: ${cartTotal.toFixed(2)}</p>
        <button onClick={() => window.location.href = "/checkout"}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
