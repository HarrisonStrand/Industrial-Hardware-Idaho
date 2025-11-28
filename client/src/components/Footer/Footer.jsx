import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { Link } from "react-router-dom";
import { DataContext } from "../../context/DataContext";
import { footerData } from "../../data/footerData.js";
import "./Footer.css";

export default function Footer() {
	const brand = useContext(DataContext);
	const sections = footerData(brand);

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
		<footer className='footer-container container-fluid bg-secondary pt-3 px-3 pt-lg-5 px-lg-5'>
			<div className='row justify-content-between'>
				{/* ---------- Section 1: Brand / Address / Newsletter ---------- */}
				<div className='col-12 col-lg-3 mb-4'>
					<div className='row justify-content-between'>
						<div className='col col-lg-2 align-items-top'>
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

					{/* Newsletter */}
					{sections.section1.showNewsletter && (
						<div className='newsletter-container col-12 mt-3'>
								<label htmlFor="newsletter-bar" className="text-main-light ps-2">Join Our Newsletter</label>
							<form className='d-flex position-relative w-100'>
								<input
									id="newsletter-bar"
									type='text'
									className='newsletter-bar d-flex w-100 fw-lighter ps-3 pe-5 align-items-center'
									placeholder='Email Address'
								/>
								<button type='submit' className='newsletter-arrow btn position-absolute end-0 top-0 pt-0 pe-1 me-1 border-0 bg-transparent'>
									<i className='bi bi-arrow-right fs-5'></i>
									</button>
							</form>
						</div>
					)}
				</div>

				{/* ---------- Other Sections ---------- */}
				{["section2", "section3", "section4"].map((key) => {
					const section = sections[key];
					return (
						<div key={key} className='col-12 col-lg-3 mb-4 text-center'>
							<div className='section-header fw-bold text-main-light mb-2'>
								{section.title}
							</div>

							{section.items.map((item, i) => (
								<div key={i} className='section-item mb-3'>
									<Link
										to={item.path}
										className='text-decoration-none fw-light text-main-light'>
										{item.text}
									</Link>
								</div>
							))}
						</div>
					);
				})}
			</div>
		</footer>
	);
}
