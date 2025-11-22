import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { DataContext } from "../../context/DataContext";
import { SearchContext } from "../../context/SearchContext.jsx";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ShopNowItems from "../../data/shop-now-items.json";
import "./Header.css";

export default function Header() {
  const brand = useContext(DataContext);
  const navigate = useNavigate();
  const location = useLocation();

  const { searchQuery, setSearchQuery } = useContext(SearchContext);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Products");

  const tabs = Object.keys(ShopNowItems);

  /* ---------------------------------------------
   * SEARCH SYNC WITH /products
   * ------------------------------------------ */
  useEffect(() => {
    if (location.pathname.startsWith("/products")) {
      const params = new URLSearchParams(location.search);
      const q = params.get("search") || "";
      setSearchQuery(q);
    } else {
      setSearchQuery("");
    }
  }, [location]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (location.pathname.startsWith("/products")) {
      if (value.trim()) {
        navigate(`/products?search=${encodeURIComponent(value)}`);
      } else {
        navigate(`/products`);
      }
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();

    if (!location.pathname.startsWith("/products")) {
      if (searchQuery.trim()) {
        navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      } else {
        navigate(`/products`);
      }
    }
  };

  /* ---------------------------------------------
   * THEME HANDLING
   * ------------------------------------------ */
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [logoSrc, setLogoSrc] = useState("");

  const updateLogoSrc = () => {
    const root = document.documentElement;
    const logoValue = getComputedStyle(root).getPropertyValue("--logo").trim();
    const match = logoValue.match(/url\((['"]?)(.*?)\1\)/);
    if (match) setLogoSrc(match[2]);
  };

  useEffect(() => {
    updateLogoSrc();
  }, []);

  useEffect(() => {
    updateLogoSrc();
  }, [theme]);

  const handleToggleTheme = () => {
    toggleTheme();
    setTimeout(updateLogoSrc, 0);
  };

  /* ---------------------------------------------
   * MOBILE MENU OPEN / CLOSE WITH ANIMATION
   * ------------------------------------------ */
  const openMenu = () => {
    setMenuClosing(false);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuClosing(true);
    // Wait for slide-up animation to finish
    setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 450); // must match CSS animation duration
  };

  return (
    <div className="header bg-main">
      {/* THEME BUTTON */}
      <button
        onClick={handleToggleTheme}
        className="theme-btn rounded-circle d-flex position-absolute"
        style={{
          backgroundColor: theme === "light" ? "#000" : "#fff",
          transition: "background-color 0.3s ease, color 0.3s ease",
        }}
      ></button>

      {/* ========================================================
       * TOP BAR
       * ====================================================== */}
      <div className="container-fluid row g-0 justify-content-between px-3 py-2 align-items-center top-bar bg-secondary-light">
        <div className="col-6 d-flex text-start justify-content-start">
          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to={`tel:${brand.phone}`}
          >
            <div className="bi bi-telephone phone-icon h5 m-0" />
            <h5 className="d-none d-md-block top-bar-text font-secondary m-0 px-2">
              {brand.phone}
            </h5>
          </Link>

          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to={`mailto:${brand.email}`}
          >
            <div className="bi bi-envelope-open mail-icon h5 m-0" />
            <h5 className="d-none d-md-block top-bar-text font-secondary m-0 px-2">
              {brand.email}
            </h5>
          </Link>
        </div>

        <div className="col-6 d-flex text-end justify-content-end">
          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to="/location"
          >
            <p className="d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase m-0 px-2">
              Location
            </p>
          </Link>
          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to="/about"
          >
            <p className="d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase m-0 px-2">
              About
            </p>
          </Link>
          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to="/orders"
          >
            <p className="d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase m-0 px-2">
              Orders
            </p>
          </Link>
          <Link
            className="ms-4 d-flex text-decoration-none text-main align-items-center"
            to="/careers"
          >
            <p className="d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase m-0 px-2">
              Careers
            </p>
          </Link>

          {/* MOBILE HAMBURGER */}
          <div className="col-2 text-end d-flex d-sm-none">
            <button
              className={`hamburger-btn ${menuOpen && !menuClosing ? "open" : ""}`}
              onClick={() => (menuOpen ? closeMenu() : openMenu())}
            >
              <span className="bar text-main bg-main"></span>
              <span className="bar text-main bg-main"></span>
              <span className="bar text-main bg-main"></span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
       * MOBILE MENU OVERLAY + PANEL (BEHIND TOP BAR)
       * ====================================================== */}
      {menuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={closeMenu}
        >

          {/* Sliding panel */}
          <div
            className={`mobile-menu ${menuClosing ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="list-unstyled text-center mt-4">
              <li className="py-3">
                <Link to="/location" onClick={closeMenu}>
                  location
                </Link>
              </li>
              <li className="py-3">
                <Link to="/about" onClick={closeMenu}>
                  about
                </Link>
              </li>
              <li className="py-3">
                <Link to="/orders" onClick={closeMenu}>
                  orders
                </Link>
              </li>
              <li className="py-3">
                <Link to="/career" onClick={closeMenu}>
                  career
                </Link>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================
       * TITLE BANNER
       * ====================================================== */}
      <nav className="navbar navbar-expand-lg container-fluid title-banner">
        <div className="container-fluid flex-row g-0 justify-content-between px-3 py-2 align-items-center">
          <div className="col-6 col-lg-10">
            <Link
              className="text-decoration-none fw-bolder fs-5 text-uppercase d-flex flex-row text-main-light"
              to="/"
            >
              <img
                src={logoSrc}
                className="header-logo col-4 col-lg-2 d-flex mx-4"
                alt={brand.brandName}
              />
              <h2 className="d-none d-md-flex text-main-light align-items-center company-title py-0 my-0 px-2 d-flex">
                {brand.brandName}
              </h2>
            </Link>
          </div>

          <div className="col-4 col-lg-2 align-items-center d-flex justify-content-end mx-0">
            <Link className="account-link rounded-circle mx-4" to="/register">
              <div className="account-thumb rounded-circle" />
            </Link>
            <div className="cart-icon py-0 my-0 d-none d-sm-flex text-main-light bi bi-bag h2" />
          </div>
        </div>
      </nav>

      {/* ========================================================
       * SEARCH BAR + SHOP NOW MEGA MENU
       * ====================================================== */}
      <div className="container-fluid row g-0 justify-content-between px-3 py-2 align-items-center search-bar-container bg-secondary">
        <div className="col-6 d-flex text-start justify-content-start">
          <div className="ms-4 d-flex text-decoration-none text-secondary-light align-items-center">
            <div
              className="shop-now-wrapper position-relative"
              onMouseEnter={() => setIsModalOpen(true)}
              onMouseLeave={() => setIsModalOpen(false)}
            >
              <div className="shop-now-trigger d-flex align-items-center position-relative z-10">
                <p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">
                  Shop Now
                </p>
                <i className="bi bi-chevron-down chevron text-secondary-light fw-bold h5 m-0" />
              </div>

              {isModalOpen && (
                <div className="category-modal position-absolute rounded-2 py-1">
                  <div className="modal-hover-bridge"></div>

                  <div className="d-flex border-bottom border-main mb-0 justify-content-between">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onMouseEnter={() => setActiveTab(tab)}
                        className={`mega-tab text-uppercase fs-6 border-0 bg-transparent pb-0 ${
                          activeTab === tab ? "active" : ""
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="category-links-wrapper d-flex row justify-content-start align-items-center">
                    {ShopNowItems[activeTab].map((item) => (
                      <Link
                        key={item.id}
                        to={item.path}
                        className="d-inline-block text-uppercase text-start text-decoration-none py-1 pe-2 category-link col-4"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="search-bar-text-line px-3"></div>

          <Link
            className="bottom-nav-link ms-4 d-flex text-decoration-none text-secondary-light align-items-center"
            to="/products"
          >
            <p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">
              Products
            </p>
          </Link>

          <div className="search-bar-text-line px-3"></div>

          <Link
            className="bottom-nav-link ms-4 d-flex text-decoration-none text-secondary-light align-items-center"
            to="/contact"
          >
            <p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">
              Contact
            </p>
          </Link>
        </div>

        <div className="col-6 d-flex text-end justify-content-end">
          <form
            onSubmit={handleSearchSubmit}
            className="d-flex position-relative w-100"
          >
            <input
              type="text"
              className="search-bar me-4 d-flex w-100 fw-lighter ps-3 pe-5 align-items-center"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search Products"
            />
            <button
              type="submit"
              className="btn position-absolute end-0 top-50 translate-middle pt-0 pe-2 me-1 border-0 bg-transparent"
            >
              <i className="bi bi-search fs-5"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
