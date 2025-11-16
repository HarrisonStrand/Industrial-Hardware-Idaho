import { useContext } from "react";
import { DataContext } from "../../context/DataContext";
import { Link } from "react-router-dom";
import "./FeatureBanner.css";

export default function FeatureBanner() {
	const brand = useContext(DataContext);

	const features = [
		{ icon: <i className='bi bi-box-seam'></i>, label: brand.bannerIcon1 },
		{
			icon: <i className='bi bi-currency-dollar'></i>,
			label: brand.bannerIcon2,
		},
		{ icon: <i className='bi bi-clock-history'></i>, label: brand.bannerIcon3 },
		{ icon: <i className='bi bi-check-circle'></i>, label: brand.bannerIcon4 },
	];

	return (
		<section className='feature-banner-container bg-accent-light'>
			<div className='feature-banner-overlay d-flex justify-content-center align-items-center'>
				<div className='feature-banner shadow-sm rounded-4 d-flex align-items-center justify-content-between px-2'>
					{/* CTA BUTTON */}
					<Link
						to='/register'
						className='feature-banner-link text-decoration-none justify-content-center d-flex'>
						<button className='feature-banner-cta rounded-4 px-0 py-2 text-uppercase fw-regular fs-3 text-main-light py-4'>
							{brand.bannerCTA}
						</button>
					</Link>

					{/* FEATURES LIST */}
					<div className='feature-items d-flex justify-content-between align-items-center flex-grow-1 ms-5'>
						{features.map((item, index) => (
							<div key={index} className='feature-item text-center px-4'>
								<div className='feature-icon mb-2 display-2'>{item.icon}</div>
								<p className='feature-label text-uppercase m-0 fs-3'>
									{item.label}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
