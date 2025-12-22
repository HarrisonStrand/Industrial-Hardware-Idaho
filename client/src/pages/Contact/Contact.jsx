import { useContext } from "react";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import { VariableContext } from "../../context/VariableContext";
import "./Contact.css";
import ContactBanner from "../../components/ContactBanner/ContactBanner";

export default function Contact() {
	const brand = useContext(BrandContext);
	const variables = useContext(VariableContext);

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='contact-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						contact Us
					</div>
					<div className='contact-detail-container py-4 rounded-4 px-3 px-sm-5'>
						<div className='row m-0'>
							{brand.contactSec1Copy.map((line, index) => (
								<div
									className='section-copy text-main text-center fw-regular mb-1'
									key={index}>
									{line}
								</div>
							))}
						</div>
						<div className='contact-info-container py-4'>
							<div className='text-main text-uppercase mb-1 fs-4 px-0 text-center'>
								Get In Touch
							</div>
							<div className='row align-items-center justify-content-evenly rounded-4 border border-3 border-main py-2 py-xl-4 px-xl-5 fw-semibold'>
								<Link
									to={`tel:${brand.phone}`}
									className='text-decoration-none col-12 col-xl-6 align-items-center contact-banner-left text-main text-uppercase text-center text-xl-end py-1 py-xl-0 px-lg-0 px-xl-5'>
									{variables.contactBannerLeft}{" "}
									<i className='px-1 bi bi-telephone' /> {brand.phone}
								</Link>
								<Link
									to={`mailto:${brand.email}`}
									className='text-decoration-none col-12 col-xl-6 align-items-center contact-banner-right text-main text-uppercase text-center text-xl-start py-1 py-xl-0 px-lg-0 px-xl-5'>
									{variables.contactBannerRight}{" "}
									<i className='px-1 bi bi-envelope-open' /> {brand.email}
								</Link>
								<div className="rounded-4 map-container m-0 g-0 bg-main mt-4">
								<iframe width="600" height="450" className="map-embed rounded-4 w-100 h-100" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?q=place_id:ChIJHYtYEkX_rlQRllfdRnvuoKQ&key=AIzaSyDiE50cinZS03RvKmWRtHo_ofr5I7hmaeo"></iframe>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
