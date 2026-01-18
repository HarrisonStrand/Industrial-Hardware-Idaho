import { useContext } from "react";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import "./Contact.css";
import ContactForm from "../../components/ContactForm/ContactForm";

export default function Contact() {
	const brand = useContext(BrandContext);

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='contact-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='row justify-content-between align-items-end'>
						<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-0 ps-sm-4 col-12 col-md-6 text-center text-md-start'>
							Contact Our Team
						</div>
						<div className='fs-4 px-0 pe-0 pe-sm-4 pb-1 col-12 col-md-6 text-center text-md-end'>
							<Link
								to={`tel:${brand.phone}`}
								className='contact-link text-decoration-none contact-banner-left text-main text-uppercase'>
								<i className='px-1 bi bi-telephone' />
								{brand.phone}
							</Link>
						</div>
					</div>
					<div className='contact-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='row m-0 pb-2 pb-sm-0'>
							{brand.contactSec1Copy.map((line, index) => (
								<div
									className='section-copy text-main text-center fw-regular mb-1'
									key={index}>
									{line}
								</div>
							))}
						</div>
						<div className='contact-info-container py-0 py-sm-4 px-2 px-sm-0'>
							<div className='contact-link-box row align-items-center justify-content-center rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold g-0'>
								<div className='fs-4 contact-form-title text-main text-uppercase text-start'>
									Contact Form
								</div>
								<div className='main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block'></div>
								<ContactForm />
								<div className='row justify-content-center justify-content-sm-start align-items-end'>
									<div className='col-12 col-md-3 col-lg text-main text-center text-lg-start pe-2 pe-lg-0 address-text text-uppercase px-0 ps-4 text-start mt-2 mt-sm-4'>
										Location:{" "}
										<span className='location-text d-none d-lg-inline text-main ps-1 '>
											{brand.address}
										</span>
									</div>
									<div className='main-linebreak w-75 border-0 border-top border-main py-2 d-block d-sm-none'></div>
									<div className='col-12 col-md-9 col-lg text-main text-center text-md-start address-text text-uppercase ps-0 ps-md-3 d-block d-lg-none'>
										{brand.address}
									</div>
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
		</>
	);
}
