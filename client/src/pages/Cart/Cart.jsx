import React from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext.jsx";
import CartItem from "../../components/Cart/CartItem/CartItem.jsx";
import "./Cart.css"; // optional, if you add styles

export default function Cart() {
  const navigate = useNavigate();
  const { items, cartTotal } = useCart();

  return (
    <div className="cart-page container py-5">
      <h1 className="mb-4">Shopping Cart</h1>

      {items.length === 0 && (
        <p className="text-muted">Your cart is empty.</p>
      )}

      <div className="cart-list">
        {items.map((item) => (
          <CartItem
            key={item.partNumber}
            item={item}
            detailed
          />
        ))}
      </div>

      {items.length > 0 && (
        <div className="cart-summary mt-5 p-4 border rounded">
          <h3 className="mb-3">Order Summary</h3>

          <div className="d-flex justify-content-between mb-2">
            <span>Subtotal</span>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>

          <button
            className="btn btn-primary w-100 mt-3"
            onClick={() => navigate("/checkout")}
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
}
