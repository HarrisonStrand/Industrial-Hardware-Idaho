import { useCart } from "../../../context/CartContext";
import "./CartDrawerItem.css";

export default function CartDrawerItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  const {
    lineId,
    partNumber,
    quantity = 1,
    lineTotal = 0,
    name,
    attributes = {},
    metadata = {},
  } = item;

  const details = [];

  if (attributes.diameter && attributes.length) {
    details.push(`${attributes.diameter} × ${attributes.length}`);
  } else {
    if (attributes.diameter) details.push(attributes.diameter);
    if (attributes.length) details.push(attributes.length);
  }

  if (attributes.thread) details.push(attributes.thread);
  if (attributes.grade) details.push(attributes.grade);
  if (attributes.finish) details.push(attributes.finish);

  const detailText =
    details.filter(Boolean).join(" • ") ||
    metadata.shortDescription ||
    "";

  const displayName =
    name ||
    metadata.shortDescription ||
    partNumber ||
    "Product";

  const handleQtyChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty > 0) {
      updateQuantity(lineId, newQty);
    }
  };

  return (
    <div className="drawer-item rounded-3 p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start">
        <div className="drawer-item-name text-main fw-semibold">
          {String(displayName).toUpperCase()}
        </div>

        <button
          className="drawer-remove-btn text-danger"
          onClick={() => removeFromCart(lineId)}
        >
          ×
        </button>
      </div>

      {detailText && (
        <div className="drawer-item-details mt-1">
          {detailText}
        </div>
      )}

      {partNumber && (
        <div className="drawer-item-part mt-1">
          Part # {partNumber}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="drawer-qty-controls d-flex align-items-center">
          <button
            className="drawer-qty-btn py-0 px-2 rounded-2 text-main"
            onClick={() => handleQtyChange(-1)}
          >
            −
          </button>

          <div className="drawer-qty-number mx-3">
            {quantity}
          </div>

          <button
            className="drawer-qty-btn py-0 px-2 rounded-2 text-main"
            onClick={() => handleQtyChange(1)}
          >
            +
          </button>
        </div>

        <div className="drawer-line-total text-main fw-semibold">
          ${Number(lineTotal || 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}