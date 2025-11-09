import { useEffect, useState } from "react";
import { useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { Link } from "react-router-dom";
import "./Header.css";

export default function Header() {
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
			<nav className='navbar navbar-expand-lg container-fluid'>
			<button
				onClick={handleToggleTheme}
				className='theme-btn rounded-circle d-flex position-absolute'
				style={{
					backgroundColor: theme === "light" ? "#000" : "#fff",
					transition: "background-color 0.3s ease, color 0.3s ease",
				}}></button>
				<div className='container-fluid flex-row g-0 justify-content-between px-3 py-2 align-items-center'>
					<div className='col-6 col-lg-8'>
						<Link
							className='text-decoration-none fw-bolder fs-5 text-uppercase d-flex flex-row text-main-light'
							to='/'>
							{/* <div className="col-4 col-lg-2 header-logo d-flex mx-4"/> */}
							<img
								src={logoSrc}
								className='header-logo col-4 col-lg-2 d-flex mx-4'
							/>
							{/* <div className="col-4 col-lg-2 header-logo d-flex mx-4"/> */}
							<h2 className='text-main-light align-items-center company-title py-0 my-0 px-2 d-flex'>
								Industrial Hardware Idaho
							</h2>
						</Link>
					</div>
					<div className='col-4 col-lg-2 align-items-center d-flex justify-content-end mx-4'>
						<Link className='account-link rounded-circle mx-4' to='/register'>
							<div className='account-thumb rounded-circle' />
						</Link>
						<div className='cart-icon py-0 my-0 d-none d-sm-flex text-main-light bi bi-bag h1'></div>
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
