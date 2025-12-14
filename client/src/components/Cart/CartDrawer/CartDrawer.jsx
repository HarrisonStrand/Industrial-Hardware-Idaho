import React from "react";
import "./CartDrawer.css";
import CartItem from "../CartItem/CartItem";
import { useCart } from "../../../context/CartContext";

export default function CartDrawer({ isOpen, onClose }) {
	const { cartItems, cartTotal } = useCart();

	return (
		<div className={`cart-drawer-overlay ${isOpen ? "open" : ""}`}>
			<div className='cart-drawer'>
				<div className='cart-drawer-title-banner py-2 bg-main'>
					<div className='cart-drawer-title text-main-light text-uppercase fs-3 text-center'>
						Cart Summary
					</div>
					<div
						className='bi bi-x close-btn text-main-light fs-4 px-2'
						onClick={onClose}
					/>
				</div>

				<div className='cart-items'>
					{cartItems.length === 0 && <p>Your cart is empty.</p>}

					{cartItems.map((item) => (
						<CartItem key={item.id + item.sku} item={item} />
					))}
				</div>

				<div className='cart-footer container-fluid g-0'>
					<div className='subtotal-container p-3'>
						<div className='subtotal-text text-main text-small text-uppercase text-end font-secondary'>
							Total:
						</div>
						<div className='subtotal-number text-end fs-2 fw-regular text-main font-secondary'>
							${cartTotal.toFixed(2)}
						</div>
					</div>
					<div className='cta-container container px-0 bg-main-light overflow-hidden'>
            <div className="row px-3 gx-4">
            <div className="col-12 col-sm-6">
						<button
							className='continue-btn text-uppercase font-secondary fw-light rounded-3 text-main fs-5 p-3 w-100'
							onClick={() => (window.location.href = "/cart")}>
							Continue Shopping
						</button>
                </div>
            <div className="col-12 col-sm-6">
						<button
							className='checkout-btn text-uppercase font-secondary fw-regular rounded-3 text-main-light fs-5 p-3 w-100'
							onClick={() => (window.location.href = "/checkout")}>
							Checkout
						</button>
                </div>
                </div>
					</div>
				</div>
			</div>
		</div>
	);
}
