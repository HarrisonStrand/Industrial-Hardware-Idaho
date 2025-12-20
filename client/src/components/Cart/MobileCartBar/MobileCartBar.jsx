import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../../context/CartContext";
import "./MobileCartBar.css";

export default function MobileCartBar() {
  const { items, cartTotal } = useCart();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(window.scrollY);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // if (items.length === 0) return null;

  return (
    <div className={`mobile-cart-bar px-3 pb-2 ${visible ? "show" : "hide"}`}>
      <button
        className="mobile-cart-btn"
        onClick={() => navigate("/cart")}
      >
        <span className="cart-count fs-5">
          {items.length} item{items.length > 1 ? "s" : ""}
        </span>
        <span className="cart-total fs-5">
          ${cartTotal.toFixed(2)}
        </span>
      </button>
    </div>
  );
}
