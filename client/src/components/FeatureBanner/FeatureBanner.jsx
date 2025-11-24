import { useContext } from "react";
import { DataContext } from "../../context/DataContext";
import { Link } from "react-router-dom";
import "./FeatureBanner.css";

export default function FeatureBanner() {
	const brand = useContext(DataContext);

	const features = [
		{ icon: <i className='display-3 bi bi-box-seam'></i>, label: brand.bannerIcon1 },
		{
			icon: <i className='display-3 bi bi-currency-dollar'></i>,
			label: brand.bannerIcon2,
		},
		{ icon: <i className='display-3 bi bi-clock-history'></i>, label: brand.bannerIcon3 },
		{ icon: <i className='display-3 bi bi-check-circle'></i>, label: brand.bannerIcon4 },
	];

	return (
		<section className='feature-banner-container bg-accent-light'>
			<div className='feature-banner-overlay container-fluid d-flex justify-content-center align-items-center py-5'>
				<div className='feature-banner rounded-4 shadow-sm mx-auto px-3 px-md-4 py-3 py-md-4'>
					<div className='row g-3 g-lg-4 align-items-center m-auto'>
						<div className='col-12 col-lg-3 d-flex justify-content-center m-auto'>
							<Link
								to='/register'
								className='feature-banner-link feature-cta d-grid text-decoration-none text-main-light'>
								<button className='btn-main-cta rounded-4 text-uppercase fw-regular fs-4 py-4 text-main-light'>
									{brand.bannerCTA}
								</button>
							</Link>
						</div>
						<div className='col col-lg-9'>
							<div className='row row-cols-2 row-cols-md-4 g-3 justify-content-center'>
								{features.map((item, index) => (
									<div key={index} className='col mt-0'>
										<div className='feature-item text-center h-100 d-flex flex-column justify-content-center align-items-center gap-2'>
											<div className='feature-icon'>{item.icon}</div>
											<p className='feature-label text-uppercase m-0 text-break fs-4 px-3'>
												{item.label}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
						{/* <div className='col-12 col-lg-8'>
							<div className='row row-cols-2 row-cols-md-4 g-3 g-md-4 justify-content-center'>
								{features.map((item, index) => (
									<div key={index} className='col mt-0'>
										<div className='feature-item text-center h-100 d-flex flex-column justify-content-center align-items-center gap-2'>
											<div className='feature-icon'>{item.icon}</div>
											<p className='feature-label text-uppercase m-0 text-break fs-4 px-1'>
												{item.label}
											</p>
										</div>
									</div>
								))}
							</div>
						</div> */}
					</div>
				</div>
			</div>
		</section>
	);
}
