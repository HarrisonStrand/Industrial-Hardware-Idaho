import { useEffect, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext.jsx";
import { Link } from "react-router-dom";
import { DataContext } from "../../context/DataContext";
import "./Footer.css";

export default function Footer() {
	const brand = useContext(DataContext);

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

	return (
		<div className='footer-container container-fluid bg-secondary py-5 px-3'>
			<div className='d-flex flex-row justify-content-between'>
				<div className='col col-lg-3 text-end'>
					<div className='row justify-content-between'>
						<div className='col col-lg-6 align-items-top'>
							<img src={logoSrc} className='footer-logo' />
						</div>
						<div className='col col-lg-6 align-items-top'>
							<div className='section-header fw-bold text-main-light'>
								Location
							</div>
							<div className='section-item text-main-light fw-light'>
								{brand.address}
							</div>
							<div className='section-header fw-bold text-main-light'>
								Phone
							</div>
							<div className='section-item text-main-light fw-light'>
								{brand.phone}
							</div>
							<div className='section-header fw-bold text-main-light'>
								Hours
							</div>
							<div className='section-item text-main-light fw-light'>
								{brand.hours}
							</div>
						</div>
						<div className="newsletter-container col-12">
							<label htmlFor="newsletter" className="text-main-light">Join</label>
							<input id="newsletter" placeholder="email address" type="text" className="newsletter form-control"/>
						</div>
					</div>
				</div>
				<div className='col col-lg-3 text-center'>
					<ul>
						<div className='section-header fw-bold text-main-light'>
							Company Info
						</div>
						<div className='section-item text-main-light fw-light'>
							<Link
								to={"/about"}
								className='text-decoration-none fw-light text-main-light'>
								About Us
							</Link>
						</div>
						<div className='section-item text-main-light fw-light'>
							<Link
								to={"/privacy"}
								className='text-decoration-none fw-light text-main-light'>
								Privacy Policy
							</Link>
						</div>
						<div className='section-item text-main-light fw-light'>
							<Link
								to={"/contact"}
								className='text-decoration-none fw-light text-main-light'>
								Contact Our Team
							</Link>
						</div>
						<div className='section-item text-main-light fw-light'>
							<Link
								to={"/terms"}
								className='text-decoration-none fw-light text-main-light'>
								Terms & Conditions
							</Link>
						</div>
					</ul>
				</div>
				<div className='col col-lg-3 text-center'>
					<div className='section-header fw-bold text-main-light'>
						<ul>
							<div className='section-header fw-bold text-main-light'>
								Customer Service
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/returns"}
									className='text-decoration-none fw-light text-main-light'>
									Returns & Exchanges
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/request"}
									className='text-decoration-none fw-light text-main-light'>
									Special Requests
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/orders"}
									className='text-decoration-none fw-light text-main-light'>
									Order Status
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/shipping"}
									className='text-decoration-none fw-light text-main-light'>
									Shipping Information
								</Link>
							</div>
						</ul>
					</div>
				</div>
				<div className='col col-lg-3 text-center'>
					<div className='section-header fw-bold text-main-light'>
						<ul>
							<div className='section-header fw-bold text-main-light'>
								Resources
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/forms"}
									className='text-decoration-none fw-light text-main-light'>
									Customer Forms
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/login"}
									className='text-decoration-none fw-light text-main-light'>
									Account Login
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/vendors"}
									className='text-decoration-none fw-light text-main-light'>
									Vendor Information
								</Link>
							</div>
							<div className='section-item text-main-light fw-light'>
								<Link
									to={"/careers"}
									className='text-decoration-none fw-light text-main-light'>
									Join Our Team
								</Link>
							</div>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
