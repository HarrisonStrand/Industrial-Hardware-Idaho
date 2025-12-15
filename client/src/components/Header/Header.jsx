import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { BrandContext } from "../../context/BrandContext";
import { SearchContext } from "../../context/SearchContext.jsx";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ShopNowItems from "../../data/shop-now-items.json";
import "./Header.css";
import CartIcon from "../Cart/CartIcon/CartIcon.jsx";

export default function Header({ onCartOpen }) {
	const brand = useContext(BrandContext);
	const navigate = useNavigate();
	const location = useLocation();

	const { searchQuery, setSearchQuery } = useContext(SearchContext);

	const [menuOpen, setMenuOpen] = useState(false);
	const [menuClosing, setMenuClosing] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("Products");

	const tabs = Object.keys(ShopNowItems);

	const [screenWidth, setScreenWidth] = useState(window.innerWidth);
	const isMobileCart = screenWidth < 800;

	useEffect(() => {
		const handleResize = () => setScreenWidth(window.innerWidth);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

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
	const [logoSrcMobile, setLogoSrcMobile] = useState("");

	const updateLogoSrc = () => {
		const root = document.documentElement;

		// Desktop logo
		const logoValue = getComputedStyle(root).getPropertyValue("--logo").trim();
		const match = logoValue.match(/url\((['"]?)(.*?)\1\)/);
		if (match) setLogoSrc(match[2]);

		// Mobile logo
		const logoMobileValue = getComputedStyle(root)
			.getPropertyValue("--logo-mobile")
			.trim();
		const matchMobile = logoMobileValue.match(/url\((['"]?)(.*?)\1\)/);
		if (matchMobile) setLogoSrcMobile(matchMobile[2]);
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
		<div className='header bg-main'>
			{/* THEME BUTTON */}
			<button
				onClick={handleToggleTheme}
				className='theme-btn rounded-circle d-flex position-absolute'
				style={{
					backgroundColor: theme === "light" ? "#000" : "#fff",
					transition: "background-color 0.3s ease, color 0.3s ease",
				}}></button>

			{/* ========================================================
			 * TOP BAR
			 * ====================================================== */}
			<div className='container-fluid row g-0 justify-content-between px-sm-3 px-3 py-2 align-items-center top-bar bg-secondary-light'>
				<div className='col-4 col-sm-6 d-flex text-start justify-content-start'>
					<Link
						className='ms-sm-2 ms-md-4 d-flex text-decoration-none text-main align-items-center'
						to={`tel:${brand.phone}`}>
						<div className='bi bi-telephone phone-icon h5 m-0' />
						<h5 className='d-none d-md-block top-bar-text font-secondary m-0 px-2'>
							{brand.phone}
						</h5>
					</Link>

					<Link
						className='ms-3 ms-md-4 d-flex text-decoration-none text-main align-items-center'
						to={`mailto:${brand.email}`}>
						<div className='bi bi-envelope-open mail-icon h5 m-0' />
						<h5 className='d-none d-md-block top-bar-text font-secondary m-0 px-2'>
							{brand.email}
						</h5>
					</Link>
				</div>
				<div className='col-4 d-flex justify-content-center d-flex d-sm-none'>
					<Link
						className='text-decoration-none fw-bolder fs-5 text-uppercase flex-row text-main-light'
						to='/'>
						<img
							src={logoSrcMobile}
							className='header-logo-mobile'
							alt={brand.brandName}
						/>
					</Link>
				</div>

				<div className='col-4 col-sm-6 d-flex text-end justify-content-end'>
					<Link
						className='ms-4 d-flex text-decoration-none text-main align-items-center'
						to='/location'>
						<p className='d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase me-0 me-md-4 mb-0'>
							Location
						</p>
					</Link>
					<Link
						className='ms-4 d-flex text-decoration-none text-main align-items-center'
						to='/about'>
						<p className='d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase me-0 me-md-4 mb-0'>
							About
						</p>
					</Link>
					<Link
						className='ms-4 d-flex text-decoration-none text-main align-items-center'
						to='/orders'>
						<p className='d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase me-0 me-md-4 mb-0'>
							Orders
						</p>
					</Link>
					<Link
						className='ms-4 d-flex text-decoration-none text-main align-items-center'
						to='/careers'>
						<p className='d-none d-sm-block d-md-block top-bar-text font-secondary text-uppercase me-0 me-sm-2 me-md-4 mb-0'>
							Careers
						</p>
					</Link>

					{/* MOBILE HAMBURGER */}
					<div className='d-flex d-sm-none ms-4 justify-content-center'>
						<button
							className={`hamburger-btn ${menuOpen && !menuClosing ? "open" : ""}`}
							onClick={() => (menuOpen ? closeMenu() : openMenu())}>
							<span className='bar text-main bg-main'></span>
							<span className='bar text-main bg-main'></span>
							<span className='bar text-main bg-main'></span>
						</button>
					</div>
				</div>
			</div>

			{/* ========================================================
			 * MOBILE MENU OVERLAY + PANEL (BEHIND TOP BAR)
			 * ====================================================== */}
			{menuOpen && (
				<div className='mobile-menu-overlay' onClick={closeMenu}>
					{/* Sliding panel */}
					<div
						className={`mobile-menu bg-main-light ${menuClosing ? "closing" : ""}`}
						onClick={(e) => e.stopPropagation()}>
						<ul className='list-unstyled text-center my-0'>
							<li className='py-2'>
								<Link
									to='/location'
									onClick={closeMenu}
									className='text-decoration-none text-main text-uppercase'>
									location
								</Link>
							</li>
							<li className='py-2'>
								<Link
									to='/about'
									onClick={closeMenu}
									className='text-decoration-none text-main text-uppercase'>
									about
								</Link>
							</li>
							<li className='py-2'>
								<Link
									to='/orders'
									onClick={closeMenu}
									className='text-decoration-none text-main text-uppercase'>
									orders
								</Link>
							</li>
							<li className='py-2'>
								<Link
									to='/career'
									onClick={closeMenu}
									className='text-decoration-none text-main text-uppercase'>
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
			<nav className='navbar navbar-expand-lg container-fluid title-banner'>
				<div className='container-fluid flex-row g-0 justify-content-between px-3 py-2 align-items-center'>
					<div className='col-6 col-md-9 col-lg-10'>
						{/* <Link
							className='text-decoration-none fw-bolder fs-5 text-uppercase d-flex flex-row text-main-light'
							to='/'>
							<img
								src={logoSrc}
								className='header-logo col-2 col-lg-2 d-none d-sm-flex mx-0 mx-md-4'
								alt={brand.brandName}
							/>
							<h2 className='d-flex text-main-light align-items-center company-title py-0 my-0 px-0 px-sm-3 px-md-2'>
								{brand.brandName}
							</h2>
						</Link> */}
						<div className='d-flex flex-row text-main-light align-items-center'>
							<Link to='/'>
								<img
									src={logoSrc}
									className='header-logo col-2 col-lg-2 d-none d-sm-flex mx-0 mx-md-4'
									alt={brand.brandName}
								/>
							</Link>
							<Link to='/' className='text-decoration-none'>
								<h2 className='text-uppercase d-flex text-main-light company-title py-0 my-0 px-0 px-sm-3 px-md-2'>
									{brand.brandName}
								</h2>
							</Link>
						</div>
					</div>

					<div className='col col-lg-2 align-items-center d-flex justify-content-end mx-sm-0 pe-0 pe-sm-2'>
						<Link
							className='account-link rounded-circle mx-sm-4 mx-3'
							to='/register'>
							<div className='account-thumb rounded-circle' />
						</Link>
						<CartIcon
							onClick={() => {
								if (isMobileCart) {
									navigate("/cart");
								} else {
									onCartOpen();
								}
							}}
						/>
					</div>
				</div>
			</nav>

			{/* ========================================================
			 * SEARCH BAR + SHOP NOW MEGA MENU
			 * ====================================================== */}
			<div className='container-fluid row g-0 d-flex justify-content-center justify-content-sm-between px-3 px-md-4 px-lg-3 py-2 align-items-center search-bar-container bg-secondary'>
				<div className='col-12 col-lg-6 d-flex text-start justify-content-center py-2 py-lg-0 justify-content-md-start'>
					<div className='ms-0 ms-md-4 d-flex text-decoration-none text-secondary-light align-items-center'>
						<div
							className={`shop-now-wrapper position-relative ${
								screenWidth <= 1350 ? "shop-now-mobile" : "shop-now-desktop"
							}`}
							onMouseEnter={() => {
								if (screenWidth > 1350) setIsModalOpen(true);
							}}
							onMouseLeave={() => {
								if (screenWidth > 1350) setIsModalOpen(false);
							}}
							onClick={() => {
								if (screenWidth <= 1350) navigate("/products");
							}}>
							<div className='shop-now-trigger d-flex align-items-center position-relative z-10'>
								<p className='search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2'>
									Shop Now
								</p>
								<i className='bi bi-chevron-down chevron text-secondary-light fw-bold h5 m-0' />
							</div>

							{screenWidth > 1350 && isModalOpen && (
								<div className='category-modal position-absolute rounded-2 py-1'>
									<div className='modal-hover-bridge'></div>

									<div className='d-flex border-bottom border-main mb-0 justify-content-between'>
										{tabs.map((tab) => (
											<button
												key={tab}
												onMouseEnter={() => setActiveTab(tab)}
												className={`mega-tab text-uppercase fs-6 border-0 bg-transparent pb-0 ${
													activeTab === tab ? "active" : ""
												}`}>
												{tab}
											</button>
										))}
									</div>

									<div className='category-links-wrapper d-flex row justify-content-start align-items-center'>
										{ShopNowItems[activeTab].map((item) => (
											<Link
												key={item.id}
												to={item.path}
												className='d-inline-block text-uppercase text-start text-decoration-none py-1 pe-2 category-link col-4'>
												{item.name}
											</Link>
										))}
									</div>
								</div>
							)}
						</div>
					</div>

					<div className='search-bar-text-line px-1 px-sm-3'></div>

					<Link
						className='bottom-nav-link ms-0 ms-sm-4 d-flex text-decoration-none text-secondary-light align-items-center'
						to='/products'>
						<p className='search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2'>
							Products
						</p>
					</Link>

					<div className='search-bar-text-line px-1 px-sm-3'></div>

					<Link
						className='bottom-nav-link ms-0 ms-sm-4 d-flex text-decoration-none text-secondary-light align-items-center'
						to='/contact'>
						<p className='search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2'>
							Contact
						</p>
					</Link>
				</div>

				<div className='col-12 col-lg-6 d-flex text-end justify-content-end px-sm-0 px-md-4 px-lg-0'>
					<form
						onSubmit={handleSearchSubmit}
						className='d-flex position-relative w-100'>
						<input
							type='text'
							className='search-bar me-lg-4 d-flex w-100 fw-lighter ps-3 pe-lg-5 align-items-center'
							value={searchQuery}
							onChange={handleSearchChange}
							placeholder='Search Products'
						/>
						<button
							type='submit'
							className='search-bar-magnifier btn position-absolute end-0 top-50 pt-0 pe-2 me-1 border-0 bg-transparent'>
							<i className='bi bi-search fs-5'></i>
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
