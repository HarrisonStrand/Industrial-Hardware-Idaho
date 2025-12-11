import React from "react";
import { useCart } from "../../../context/CartContext";
import "./CartItem.css";

export default function CartItem({ item, detailed = false }) {
  const { updateQuantity, removeFromCart } = useCart();

  const handleQtyChange = (type) => {
    const newQty = type === "inc" ? item.quantity + 1 : item.quantity - 1;
    if (newQty > 0) updateQuantity(item.sku, newQty);
  };

  return (
    <div className={`cart-item ${detailed ? "detailed" : ""}`}>
      {/* Image */}
      {item.image && (
        <img src={item.image} alt={item.name} className="cart-item-img" />
      )}

      <div className="cart-item-info">
        {/* Title */}
        <h3 className="cart-item-title">{item.name}</h3>

        {/* Attributes (Diameter, Length, Finish, Grade, etc.) */}
        <div className="cart-item-attributes">
          {Object.entries(item.attributes || {}).map(([key, value]) => (
            <p key={key}>
              <strong>{key.replace("_", " ")}:</strong> {value}
            </p>
          ))}
        </div>

        {/* Quantity Controls */}
        <div className="cart-item-qty">
          <button onClick={() => handleQtyChange("dec")}>−</button>
          <span>{item.quantity}</span>
          <button onClick={() => handleQtyChange("inc")}>+</button>
        </div>

        {/* Price */}
        <div className="cart-item-price">
          ${Number(item.price * item.quantity).toFixed(2)}
        </div>

        {/* Remove */}
        <button
          className="cart-item-remove"
          onClick={() => removeFromCart(item.sku)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
