import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import { footerData } from "../../data/footerData.js";
import "./Footer.css";

export default function Footer() {
	const brand = useContext(BrandContext);
	const sections = footerData(brand);
	const currentYear = new Date().getFullYear();


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
	}, [theme]);

	return (
		<footer className='footer-container container-fluid bg-secondary pt-4 px-3 px-sm-4 pt-md-5'>
			<div className='row justify-content-center justify-content-lg-between'>
				{/* ---------- Section 1: Brand / Address / Newsletter ---------- */}
				<div className='col-12 col-lg-3'>
					<div className='row justify-content-between'>
						<div className='col-4 col-md-3 col-lg-4 align-items-top'>
							<img src={logoSrc} className='footer-logo mb-4' />
						</div>
						<div className='col col-lg-8 align-items-top text-end'>
							{sections.section1.items.map((item, i) => (
								<div key={i} className='mb-3'>
									<div className='section-header fw-bold text-main-light mb-2'>
										{item.label}
									</div>
									{item.path ? (
										<Link
											to={item.path}
											className='section-item text-main-light fw-light text-decoration-none'>
											{item.text}
										</Link>
									) : (
										<div className='section-item text-main-light fw-light'>
											{item.text}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				</div>

				{/* ---------- Other Sections ---------- */}
				{["section2", "section3", "section4"].map((key) => {
					const section = sections[key];
					return (
						<div
						key={key}
						className={`order-1 order-lg-0 col-sm col-md col-lg-3 px-3 pb-3 ${section.textAlign}`}>
							<div className='section-header fw-bold text-main-light mb-2'>
								{section.title}
							</div>

							{section.items.map((item, i) => (
								<div key={i} className='section-item mb-2 mb-md-4'>
									<Link
										to={item.path}
										onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
										className='text-decoration-none fw-light text-main-light'>
										{item.text}
									</Link>
								</div>
							))}
						</div>
					);
				})}

			{/* Newsletter */}
			{sections.section1.showNewsletter && (
				<div className='order-0 row justify-content-between px-2'>
					<div className='newsletter-container col-12 col-sm-8 col-md col-lg-3 mt-0 mb-3 pe-1'>
						<label htmlFor='newsletter-bar' className='text-main-light ps-2'>
							Join Our Newsletter
						</label>
						<form className='d-flex position-relative w-100'>
							<input
								id='newsletter-bar'
								type='text'
								className='newsletter-bar d-flex w-100 fw-lighter ps-3 pe-5 align-items-center'
								placeholder='Email Address'
							/>
							<button
								type='submit'
								className='newsletter-arrow btn position-absolute end-0 top-0 pt-0 pe-1 me-1 border-0 bg-transparent'>
								<i className='bi bi-arrow-right fs-5'></i>
							</button>
						</form>
					</div>
					<div className="col-12 col-sm-2 col-md col-md-3 mt-0 mb-3 text-center align-self-end">
						<div className="small copyright-text">
							All rights reserved &#xA9; Wollum Ventures LLC {currentYear}
						</div>
					</div>
					<div className="social-icon-container col-12 col-sm-2 align-items-center d-flex justify-content-center justify-content-sm-end text-end px-0 pb-3 pb-sm-0 pt-0 pt-sm-3">
						<div className="social-icon">
							<i className="bi bi-facebook fs-2 text-main-light ps-3"></i>
						</div>
						<div className="social-icon">
							<i className="bi bi-instagram fs-2 text-main-light ps-3"></i>
						</div>
						<div className="social-icon">
							<i className="bi bi-twitter fs-2 text-main-light ps-3"></i>
						</div>
					</div>
					<div className="divider-line w-100 d-flex d-lg-none mb-4"></div>
				</div>
			)}
			</div>
		</footer>
	);
}
