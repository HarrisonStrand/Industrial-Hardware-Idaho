import React from "react";
import "./CartDrawer.css";
import CartDrawerItem from "./CartDrawerItem";
import { useCart } from "../../../context/CartContext";
import { Link } from "react-router-dom";

export default function CartDrawer({ isOpen, onClose }) {
	const { items, cartTotal } = useCart();

	return (
		<div className={`cart-drawer-overlay ${isOpen ? "open" : ""}`}>
			<div className='cart-drawer'>
				<div className='cart-drawer-title-banner py-2 bg-main'>
					<div className='cart-drawer-title text-main-light text-uppercase text-center'>
						Cart Summary
					</div>
					<div
						className='bi bi-x close-btn text-main-light fs-4 px-2'
						onClick={onClose}
					/>
				</div>

				<div className='cart-items'>
					{items.length === 0 && (
						<div className='text-main text-center p-4'>Your cart is empty.</div>
					)}

					{items.map((item) => (
						<CartDrawerItem key={item.lineId} item={item} />
					))}
				</div>

				<div className='cart-footer container-fluid g-0'>
					<div className='subtotal-container p-3'>
						<div className='subtotal-text text-main text-small text-uppercase text-end font-secondary'>
							Total:
						</div>
						<div className='subtotal-number text-end fs-2 fw-regular text-main font-secondary'>
							${Number(cartTotal || 0).toFixed(2)}
						</div>
					</div>

					<div className='cta-container container px-0 bg-main-light overflow-hidden'>
						<div className='row px-3 gx-4'>
							<div className='col-12 col-lg-6'>
								<Link to='/products'>
									<button className='continue-btn text-uppercase font-secondary fw-light rounded-3 text-main p-3 w-100'>
										Browse Products
									</button>
								</Link>
							</div>
							<div className='col-12 col-lg-6'>
								<Link to='/checkout'>
									<button className='checkout-btn text-uppercase font-secondary fw-regular rounded-3 text-main-light p-3 w-100'>
										Checkout
									</button>
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}