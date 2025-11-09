import { useEffect, useState } from "react";
import { useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { DataContext } from "../../context/DataContext";
import { Link, useNavigate } from "react-router-dom";
import data from "../../data/products-test.json";
import "./Header.css";

export default function Header() {
	const brand = useContext(DataContext);

	// SEARCH BAR FUNCTIONALITY
	const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

	const handleSearch = (value) => {
    setQuery(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    const normalizedQuery = value.toLowerCase();

    const filtered = data.products.filter((p) => {
      const name = p.name.toLowerCase();
      const type = p.type.toLowerCase();
      const grade = p.grade.toLowerCase();
      const material = p.material.toLowerCase();
      const diameter = p.diameter.toLowerCase();
      const length = p.length.toLowerCase();
      const thread = p.thread.toLowerCase();
      const finish = p.finish.toLowerCase();

      return (
        name.includes(normalizedQuery) ||
        type.includes(normalizedQuery) ||
        grade.includes(normalizedQuery) ||
        material.includes(normalizedQuery) ||
        diameter.includes(normalizedQuery) ||
        length.includes(normalizedQuery) ||
        thread.includes(normalizedQuery) ||
        finish.includes(normalizedQuery) ||
        `${grade} ${type}`.includes(normalizedQuery) ||
        `${type} ${grade}`.includes(normalizedQuery) ||
        normalizedQuery.includes(diameter.replace(/[^0-9/]/g, ""))
      );
    });

    setResults(filtered);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results.length === 1) {
      navigate(`/product/${results[0].id}`);
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
					<input type="text" className="search-bar me-4 d-block w-100" placeholder="Search Products"/>
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
