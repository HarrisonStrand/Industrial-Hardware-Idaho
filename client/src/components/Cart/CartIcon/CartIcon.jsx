import React from "react";
import { useCart } from "../../../context/CartContext";
import "./CartIcon.css";

export default function CartIcon({ onClick }) {
  const { cartItemCount } = useCart();

  return (
		<div className='cart-icon py-0 my-0 d-flex text-main-light bi bi-bag h2 me-0 me-md-4' onClick={onClick}
      aria-label="Cart">
      {cartItemCount > 0 && (
        <span className="text-main cart-qty-badge position-absolute rounded-pill bg-main-light">
          {cartItemCount}
        </span>
      )}
		</div>
  );
}
