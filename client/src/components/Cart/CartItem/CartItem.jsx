import React from "react";
import { useCart } from "../../../context/CartContext";
import "./CartItem.css";

export default function CartItem({ item, detailed = false }) {
  const { updateQuantity, removeFromCart } = useCart();

  if (!item.sku) return null;

  const { partNumber, quantity, sku, lineTotal } = item;

  const handleQtyChange = (type) => {
    const newQty =
      type === "inc" ? quantity + 1 : quantity - 1;

    if (newQty > 0) {
      updateQuantity(partNumber, newQty);
    }
  };

  return (
    <div className={`cart-item ${detailed ? "detailed" : ""}`}>
      <div className="cart-item-info">
        {/* TITLE */}
        <h3 className="cart-item-title">
          {partNumber}
        </h3>

        {/* ATTRIBUTES */}
        <div className="cart-item-attributes">
          {Object.entries(sku.attributes || {}).map(
            ([key, value]) => (
              <p key={key}>
                <strong>
                  {key.replace("_", " ")}:
                </strong>{" "}
                {value}
              </p>
            )
          )}
        </div>

        {/* QUANTITY CONTROLS */}
        <div className="cart-item-qty">
          <button onClick={() => handleQtyChange("dec")}>
            −
          </button>
          <span>{quantity}</span>
          <button onClick={() => handleQtyChange("inc")}>
            +
          </button>
        </div>

        {/* PRICE */}
        <div className="cart-item-price">
          ${lineTotal.toFixed(2)}
        </div>

        {/* REMOVE */}
        <button
          className="cart-item-remove"
          onClick={() => removeFromCart(partNumber)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
