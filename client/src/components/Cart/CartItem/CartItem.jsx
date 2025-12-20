import { Link } from "react-router-dom";
import { useCart } from "../../../context/CartContext";
import "./CartItem.css";

export default function CartItem({ item }) {
	const { updateQuantity, removeFromCart } = useCart();

	const { partNumber, quantity, sku, lineTotal } = item;
	const { attributes } = sku;

	// --------------------------------------------------
	// BUILD DETAIL LINES (clean + readable)
	// --------------------------------------------------
	const detailLines = [];

	if (attributes.diameter && attributes.length) {
		detailLines.push(`${attributes.diameter} × ${attributes.length}`);
	}

	if (attributes.thread) {
		detailLines.push(attributes.thread);
	}

	if (attributes.grade) {
		detailLines.push(attributes.grade);
	}

	if (attributes.finish) {
		detailLines.push(attributes.finish);
	}

	const handleQtyChange = (delta) => {
		const newQty = quantity + delta;
		if (newQty > 0) {
			updateQuantity(partNumber, newQty);
		}
	};

	return (
		<div className='item-detail-container p-3 rounded-3 m-0 row justify-content-between gap-3'>
			{/* IMAGE */}
				<div className='item-image-card col cart-col image rounded-3 overflow-hidden'>
					<img src='' className='cart-image-placeholder item-image' />
				</div>
			<div className='item-detail-card col-11 cart-row row justify-content-center p-3 rounded-3 m-0'>
				{/* NAME */}
				<div className='cart-col name col'>
					<Link
						to={`/products/${sku.category}/${sku.subcategory}`}
						className='cart-item-name'>
						{sku.subcategory.replace(/-/g, " ").toUpperCase()}
					</Link>
				</div>

				{/* DETAIL */}
				<div className='cart-col detail col'>
					{detailLines.map((line, i) => (
						<div key={i} className='cart-detail-line'>
							{line}
						</div>
					))}
				</div>

				{/* PART NUMBER */}
				<div className='cart-col part col'>{partNumber}</div>

				{/* QTY */}
				<div className='cart-col qty d-flex gap-2 col'>
					<div className='qty-btn' onClick={() => handleQtyChange(-1)}>
						−
					</div>
					<div className='mx-0'>{quantity}</div>
					<div className='qty-btn' onClick={() => handleQtyChange(1)}>
						+
					</div>
				</div>

				{/* PRICE */}
				<div className='cart-col price text-end col'>${lineTotal.toFixed(2)}</div>

				{/* REMOVE */}
				<div className='cart-col remove col'>
					<div
						className='remove-btn'
						onClick={() => removeFromCart(partNumber)}>
						×
					</div>
				</div>
			</div>
		</div>
	);
}
