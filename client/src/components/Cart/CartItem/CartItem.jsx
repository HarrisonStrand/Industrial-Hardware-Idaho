import { Link } from "react-router-dom";
import { useCart } from "../../../context/CartContext";
import "./CartItem.css";

export default function CartItem({ item }) {
	const { updateQuantity, removeFromCart } = useCart();

	const {
		lineId,
		partNumber,
		quantity = 1,
		lineTotal = 0,
		name,
		image,
		attributes = {},
		metadata = {},
	} = item;

	const category = metadata.category || "";
	const subcategory = metadata.subcategory || "";

	const detailLines = [];

	if (attributes.diameter && attributes.length) {
		detailLines.push(`${attributes.diameter} × ${attributes.length}`);
	} else {
		if (attributes.diameter) detailLines.push(attributes.diameter);
		if (attributes.length) detailLines.push(attributes.length);
	}

	if (attributes.thread) detailLines.push(attributes.thread);
	if (attributes.grade) detailLines.push(attributes.grade);
	if (attributes.finish) detailLines.push(attributes.finish);

	if (!detailLines.length && metadata.shortDescription) {
		detailLines.push(metadata.shortDescription);
	}

	const displayName =
		name ||
		metadata.shortDescription ||
		partNumber ||
		"Product";

	const categoryPath =
		category && subcategory ? `/products/${category}/${subcategory}` : "/products";

	const handleQtyChange = (delta) => {
		const newQty = quantity + delta;
		if (newQty > 0) {
			updateQuantity(lineId, newQty);
		}
	};

	return (
		<div className='item-detail-container p-3 rounded-3 m-0 row justify-content-between gap-3 text-start'>
			<div className='item-image-card col cart-col image rounded-3 overflow-hidden'>
				{image ? (
					<img
						src={image}
						alt={displayName}
						className='cart-image-placeholder item-image'
					/>
				) : (
					<div className='cart-image-placeholder item-image' />
				)}
			</div>

			<div className='item-detail-card col-11 cart-row row justify-content-center p-3 rounded-3 m-0'>
				<div className='cart-col name col-3'>
					<div
						className='part-label text-secondary small text-uppercase'
						htmlFor='part-name'
					>
						Name
					</div>

					<Link
						to={categoryPath}
						id='part-name'
						className='cart-item-name text-decoration-none text-main'
					>
						{String(displayName).toUpperCase()}
					</Link>
				</div>

				<div className='cart-col detail col'>
					<div
						className='part-label text-secondary small text-uppercase'
						htmlFor='part-detail'
					>
						Detail
					</div>

					<div className='row d-flex align-items-center'>
						{detailLines.map((line, i) => (
							<div
								key={i}
								id='part-detail'
								className='cart-detail-line text-main col-3'
							>
								{line}
							</div>
						))}
					</div>
				</div>

				<div id='part-number' className='cart-col part col-2 text-main'>
					<div
						className='part-label text-secondary small text-uppercase'
						htmlFor='part-number'
					>
						Part #
					</div>
					{partNumber}
				</div>

				<div className='cart-col col-1 text-center'>
					<div
						className='part-label text-secondary small text-uppercase'
						htmlFor='part-qty'
					>
						Quantity
					</div>

					<div
						id='part-qty'
						className='qty d-flex gap-2 col text-main align-items-center justify-content-center'
					>
						<div className='qty-btn' onClick={() => handleQtyChange(-1)}>
							−
						</div>

						<div className='mx-0'>{quantity}</div>

						<div className='qty-btn' onClick={() => handleQtyChange(1)}>
							+
						</div>
					</div>
				</div>

				<div
					id='product-price'
					className='cart-col price text-end col-1 text-main'
				>
					<div
						className='part-label text-secondary small text-uppercase'
						htmlFor='product-price'
					>
						Price
					</div>
					${Number(lineTotal || 0).toFixed(2)}
				</div>

				<div className='cart-col remove col-1 text-danger text-end'>
					<div
						className='remove-btn'
						onClick={() => removeFromCart(lineId)}
					>
						×
					</div>
				</div>
			</div>
		</div>
	);
}