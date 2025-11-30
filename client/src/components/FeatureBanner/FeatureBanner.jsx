import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import { Link } from "react-router-dom";
import "./FeatureBanner.css";

export default function FeatureBanner() {
	const brand = useContext(BrandContext);

	const features = [
		{
			icon: <i className='display-2 bi bi-box-seam'></i>,
			label: brand.bannerIcon1,
		},
		{
			icon: <i className='display-2 bi bi-currency-dollar'></i>,
			label: brand.bannerIcon2,
		},
		{
			icon: <i className='display-2 bi bi-clock-history'></i>,
			label: brand.bannerIcon3,
		},
		{
			icon: <i className='display-2 bi bi-check-circle'></i>,
			label: brand.bannerIcon4,
		},
	];

	return (
		<section className='feature-banner-container'>
			<div className='feature-banner-overlay container-fluid d-flex justify-content-center align-items-center py-3 py-md-5'>
				<div className='feature-banner rounded-4 mx-auto px-3 px-md-4 py-3 py-md-4'>
					<div className='row g-5 g-xl-4 align-items-center m-auto'>
						<div className='col-12 col-xl-3 d-flex justify-content-center justify-content-xl-start m-auto order-1 order-md-0 pt-4 pt-md-0 pb-md-3 pb-xl-0'>
							<Link
								to='/register'
								className='feature-banner-link feature-cta d-flex justify-content-center justify-content-xl-start text-decoration-none text-main-light w-100 w-xl-auto'>
								<button className='btn-main-cta rounded-4 text-uppercase fw-regular fs-3 py-4 text-main-light'>
									{brand.bannerCTA}
								</button>
							</Link>
						</div>
						<div className='col col-xl-9 px-0 mt-3'>
							<div className='row row-cols-2 row-cols-md-4 g-3 justify-content-center'>
								{features.map((item, index) => (
									<div key={index} className='col mt-0'>
										<div className='feature-item text-center h-100 d-flex flex-column justify-content-center align-items-center gap-md-2 gap-0 py-3 py-xl-0'>
											<div className='feature-icon'>{item.icon}</div>
											<p className='feature-label text-uppercase m-0 text-break px-xl-3'>
												{item.label}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
