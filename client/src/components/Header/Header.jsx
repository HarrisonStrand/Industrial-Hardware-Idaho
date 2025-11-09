import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { DataContext } from "../../context/DataContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import data from "../../data/products-test.json";
import "./Header.css";

export default function Header() {
	const brand = useContext(DataContext);
	
  const navigate = useNavigate();
  const location = useLocation();

  const isProductListPage = location.pathname === "/products";

  // SEARCH
  const [query, setQuery] = useState("");

  const handleSearch = (value) => {
    setQuery(value);

  if (location.pathname === "/products") {
    const params = new URLSearchParams();
    if (value.trim()) params.set("search", value.trim());
    navigate(`/products?${params.toString()}`, { replace: true }); // 👈 updates URL without reload
    return;
  }

    const normalizedQuery = value.toLowerCase();
    const filtered = data.products.filter((p) => {
      const fields = [
        p.name,
        p.type,
        p.grade,
        p.material,
        p.diameter,
        p.length,
        p.thread,
        p.finish,
      ].map((f) => f.toLowerCase());
      return fields.some((f) => f.includes(normalizedQuery));
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 🔹 If we're on ProductList, do nothing special (live search handles it)
    if (isProductListPage) return;

    // 🔹 If not on ProductList, redirect to filtered results
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setQuery("");
    }
  };

// THEME BUTTON HANDLING
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


	return (
		<div className='header bg-main'>
						<button
				onClick={handleToggleTheme}
				className='theme-btn rounded-circle d-flex position-absolute'
				style={{
					backgroundColor: theme === "light" ? "#000" : "#fff",
					transition: "background-color 0.3s ease, color 0.3s ease",}}>
			</button>
			<div className="container-fluid row g-0 justify-content-between px-3 py-2 align-items-center top-bar bg-secondary-light">
				<div className="col-6 d-flex text-start justify-content-start">
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to={`tel:${brand.phone}`}>
						<div className="bi bi-telephone phone-icon text-main h5 m-0"/>
						<h5 className="top-bar-text text-main font-secondary m-0 px-2">{brand.phone}</h5>
					</Link>
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to={`mailto:${brand.email}`}>
						<div className="bi bi-envelope-open mail-icon text-main h5 m-0"/>
						<h5 className="top-bar-text text-main font-secondary m-0 px-2">{brand.email}</h5>
					</Link>
				</div>
				<div className="col-6 d-flex text-end justify-content-end">
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to="/location">
						<p className="top-bar-text text-main font-secondary text-uppercase m-0 px-2">Location</p>
					</Link>
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to="/about`">
						<p className="top-bar-text text-main font-secondary text-uppercase m-0 px-2">About</p>
					</Link>
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to="/orders`">
						<p className="top-bar-text text-main font-secondary text-uppercase m-0 px-2">orders</p>
					</Link>
					<Link className="ms-4 d-flex text-decoration-none text-main align-items-center" to="/careers`">
						<p className="top-bar-text text-main font-secondary text-uppercase m-0 px-2">careers</p>
					</Link>
				</div>
			</div>
			<nav className='navbar navbar-expand-lg container-fluid title-banner'>
				<div className='container-fluid flex-row g-0 justify-content-between px-3 py-2 align-items-center'>
					<div className='col-6 col-lg-8'>
						<Link
							className='text-decoration-none fw-bolder fs-5 text-uppercase d-flex flex-row text-main-light'
							to='/'>
							<img
								src={logoSrc}
								className='header-logo col-4 col-lg-2 d-flex mx-4'
							/>
							<h2 className='text-main-light align-items-center company-title py-0 my-0 px-2 d-flex'>
								{brand.brandName}
							</h2>
						</Link>
					</div>
					<div className='col-4 col-lg-2 align-items-center d-flex justify-content-end mx-0 mx-sm-4'>
						<Link className='account-link rounded-circle mx-4' to='/register'>
							<div className='account-thumb rounded-circle' />
						</Link>
						<div className='cart-icon py-0 my-0 d-none d-sm-flex text-main-light bi bi-bag h2'/>
					</div>
					<div className='col-2 text-end d-none'>
						<button
							className='navbar-toggler'
							type='button'
							data-bs-toggle='collapse'
							data-bs-target='#navMain'>
							<span className='navbar-toggler-icon' />
						</button>
					</div>
				</div>
			</nav>
			<div className="container-fluid row g-0 justify-content-between px-3 py-2 align-items-center search-bar-container bg-secondary">
				<div className="col-6 d-flex text-start justify-content-start">
					<Link className="ms-4 d-flex text-decoration-none text-secondary-light align-items-center" to="/products">
						<p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">Shop Now</p>
						<div className="bi bi-chevron-down chevron text-secondary-light fw-bold h5 m-0"/>
					</Link>
					<div className="search-bar-text-line px-3"></div>
					<Link className="ms-4 d-flex text-decoration-none text-secondary-light align-items-center" to="/products`">
						<p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">Products</p>
					</Link>
					<div className="search-bar-text-line px-3"></div>
					<Link className="ms-4 d-flex text-decoration-none text-secondary-light align-items-center" to="/contact`">
						<p className="search-bar-text text-secondary-light font-secondary fw-bold text-uppercase m-0 px-2">contact</p>
					</Link>
				</div>
				<div className="col-6 d-flex text-end justify-content-end">
					<form onSubmit={handleSubmit} className="d-flex position-relative w-100">
						<input type="text" className="search-bar me-4 d-flex w-100 fw-lighter ps-3 pe-5 align-items-center" value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search Products"/>
					<button type="submit" className="btn position-absolute end-0 top-50 translate-middle pt-0 pe-2 me-1 border-0 bg-transparent">
						<i className="bi bi-search fs-5"></i>
					</button>
					</form>
				</div>
			</div>
			<div className='collapse navbar-collapse' id='navMain'>
				<ul className='navbar-nav ms-auto gap-lg-2'>
					<li className='nav-item text-uppercase'>
						<Link className='nav-link' to='/products'>
							SHOP NOW
						</Link>
					</li>
				</ul>
			</div>
		</div>
	);
}
