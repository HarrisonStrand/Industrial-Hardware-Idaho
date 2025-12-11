import React from "react";
import { useCart } from "../../../context/CartContext";
import "./CartIcon.css";

export default function CartIcon({ onClick }) {
  const { cartQuantity } = useCart();

  return (
    <div className="cart-icon-wrapper" onClick={onClick}>
	<div className='cart-icon py-0 my-0 d-flex text-main-light bi bi-bag h2 me-0 me-md-4' />

      {cartQuantity > 0 && (
        <span className="cart-qty-badge">{cartQuantity}</span>
      )}
    </div>
  );
}
