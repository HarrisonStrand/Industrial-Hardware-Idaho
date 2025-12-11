import React from "react";
import "./CartDrawer.css";
import CartItem from "../CartItem/CartItem";
import { useCart } from "../../../context/CartContext";

export default function CartDrawer({ isOpen, onClose }) {
  const { cartItems, cartTotal } = useCart();

  return (
    <div className={`cart-drawer-overlay ${isOpen ? "open" : ""}`}>
      <div className="cart-drawer">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Your Cart</h2>

        <div className="cart-items">
          {cartItems.length === 0 && <p>Your cart is empty.</p>}

          {cartItems.map((item) => (
            <CartItem key={item.id + item.sku} item={item} />
          ))}
        </div>

        <div className="cart-footer">
          <div className="subtotal-row">
            <span>Subtotal:</span>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>

          <button onClick={() => window.location.href = "/cart"}>
            View Cart
          </button>

          <button className="checkout-btn" onClick={() => window.location.href = "/checkout"}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
