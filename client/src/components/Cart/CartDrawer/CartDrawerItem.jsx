import { useCart } from "../../../context/CartContext";
import "./CartDrawerItem.css";

export default function CartDrawerItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  const { partNumber, quantity, sku, lineTotal } = item;
  const { attributes } = sku;

  const details = [];
  if (attributes.diameter && attributes.length)
    details.push(`${attributes.diameter} × ${attributes.length}`);
  if (attributes.thread) details.push(attributes.thread);
  if (attributes.grade) details.push(attributes.grade);
  if (attributes.finish) details.push(attributes.finish);

  const detailText = details.filter(Boolean).join(" • ");

  const handleQtyChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty > 0) updateQuantity(partNumber, newQty);
  };

  return (
    <div className="drawer-item rounded-3 p-3 mb-3">

      {/* TOP ROW */}
      <div className="d-flex justify-content-between align-items-start">
        <div className="drawer-item-name text-main fw-semibold">
          {sku.subcategory.replace(/-/g, " ").toUpperCase()}
        </div>

        <button
          className="drawer-remove-btn text-danger"
          onClick={() => removeFromCart(partNumber)}
        >
          ×
        </button>
      </div>

      {/* DETAILS */}
      {detailText && (
        <div className="drawer-item-details mt-1">
          {detailText}
        </div>
      )}

      {/* PART NUMBER */}
      <div className="drawer-item-part mt-1">
        Part # {partNumber}
      </div>

      {/* BOTTOM ROW */}
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
          ${lineTotal.toFixed(2)}
        </div>

      </div>
    </div>
  );
}
