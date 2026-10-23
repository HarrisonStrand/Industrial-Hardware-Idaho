import useSiteSwitches from "../../../hooks/useSiteSwitches.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import "./AddToCartButton.css";

// Add to Cart that follows the cart switch (Admin > Catalog). While the cart is off, customers see a locked
// button that reads "Coming Soon" on hover (and always on touch screens); admins can still add to cart.
export default function AddToCartButton({ className = "", onClick, disabled = false, children = "Add to Cart" }) {
	const { cartEnabled } = useSiteSwitches();
	const { isAdmin, loadingAuth } = useAuth();
	const locked = !cartEnabled && !(isAdmin && !loadingAuth);

	if (locked) {
		return (
			<button
				type='button'
				className={`${className} add-to-cart-locked`}
				aria-disabled='true'
				title='Coming Soon'
				onClick={(e) => e.preventDefault()}>
				<span className='add-to-cart-label'>{children}</span>
				<span className='add-to-cart-soon'>Coming Soon</span>
			</button>
		);
	}

	return (
		<button type='button' className={className} onClick={onClick} disabled={disabled}>
			{children}
		</button>
	);
}
