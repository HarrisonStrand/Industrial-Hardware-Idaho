import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../../context/CartContext.jsx";
import CartItem from "../../components/Cart/CartItem/CartItem.jsx";
import "./Cart.css"; // optional, if you add styles

export default function Cart() {
	const navigate = useNavigate();
	const { items, cartTotal } = useCart();

	return (
		<div className='theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='theme-detail-container py-4 cart-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='row py-4 m-0'>
					<div className='text-main text-uppercase mb-1 fs-4 px-0'>
						Cart Summary
					</div>
					<div className='main-linebreak border-0 border-top border-main py-2' />

					{items.length === 0 && (
						<p className='text-muted'>Your cart is empty.</p>
					)}

					<div className='cart-list g-0'>
						{items.map((item) => (
							<CartItem key={item.partNumber} item={item} detailed />
						))}
					</div>
				</div>

				<div className='row justify-content-between cta-button-row'>
					<div className='col-12 col-lg-6 text-start'>
						<Link to='/products'>
							<button className='continue-btn text-uppercase font-secondary fw-light rounded-3 text-main p-3 w-25'>
								Continue Shopping
							</button>
						</Link>
					</div>
					<div className='col-12 col-lg-6 text-end'>
						<Link to='/checkout'>
							<button className='checkout-btn text-uppercase font-secondary fw-regular rounded-3 text-main-light p-3 w-25'>
								Checkout
							</button>
						</Link>
					</div>
				</div>

				{items.length > 0 && (
					<div className='row justify-content-end bottom-price-row py-4 m-0'>
						<div className='main-linebreak border-0 border-top border-main py-2' />
						<div className='subtotal-text text-main text-small text-uppercase text-end font-secondary'>
							Total:
						</div>
						<div className='col-12 price-container text-end fs-1 text-main font-secondary'>
							${cartTotal.toFixed(2)}
						</div>
					</div>
				)}

			</div>
		</div>
	);
}
