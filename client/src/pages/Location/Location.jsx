import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import "./Location.css";
import ContactBanner from "../../components/ContactBanner/ContactBanner";

export default function Location() {
	const brand = useContext(BrandContext);

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						location
					</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='row m-0 pb-2 pb-sm-0'>
							{brand.locationSec1Copy.map((line, index) => (
								<div
									className='section-copy text-main text-center fw-regular mb-0'
									key={index}>
									{line}
								</div>
							))}
						</div>
						<div className='theme-info-container py-0 py-sm-4 px-2 px-sm-0'>
							<div className='location-link-box row align-items-center justify-content-evenly rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold'>
								<div className="row justify-content-center justify-content-sm-start align-items-end">
								<div className='col-12 col-md-3 col-lg text-main text-center text-lg-start pe-2 pe-lg-0 address-text text-uppercase px-0 ps-4 text-start mt-2'>
									Location: <span className="location-text d-none d-lg-inline text-main ps-1 ">{brand.address}</span>
								</div>
								<div className='main-linebreak w-75 border-0 border-top border-main py-2 d-block d-sm-none'></div>
									<div className="col-12 col-md-9 col-lg text-main text-center text-md-start address-text text-uppercase ps-0 ps-md-3 d-block d-lg-none">{brand.address}</div>
								</div>
								<div className='rounded-4 map-container bg-main m-0 mt-2 mt-sm-0 g-0'>
									<iframe
										className='map-embed rounded-4 w-100 h-100'
										loading='lazy'
										allowFullScreen
										src='https://www.google.com/maps/embed/v1/place?q=place_id:ChIJHYtYEkX_rlQRllfdRnvuoKQ&key=AIzaSyDiE50cinZS03RvKmWRtHo_ofr5I7hmaeo'></iframe>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<ContactBanner/>
		</>
	);
}
