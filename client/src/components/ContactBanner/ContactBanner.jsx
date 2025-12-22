import { useContext } from "react";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import { VariableContext } from "../../context/VariableContext";
import "./ContactBanner.css";

export default function ContactBanner() {
		const brand = useContext(BrandContext);
		const variables = useContext(VariableContext);

	return (
<div className='contact-banner-container m-5 align-items-center d-flex row justify-content-center m-auto pb-5 py-0 pb-xl-5 px-0 px-lg-5'>
				<div className='main-linebreak border-0 border-top border-main py-2'></div>
				<div className='contact-banner-title text-main text-center text-uppercase mb-3'>
					{variables.contactBannerTitle}
				</div>
				<div className="contact-banner-card row align-items-center justify-content-evenly rounded-4 border border-3 border-main py-2 py-xl-3 px-xl-3 fw-semibold">
					<Link to={`tel:${brand.phone}`} className="text-decoration-none col-12 col-xl-6 align-items-center contact-banner-left text-main text-uppercase text-center text-xl-end py-1 py-xl-0 px-lg-0 px-xl-5">
						{variables.contactBannerLeft} <i className="px-1 bi bi-telephone"/> {brand.phone}
					</Link>
					<Link to={`mailto:${brand.email}`} className="text-decoration-none col-12 col-xl-6 align-items-center contact-banner-right text-main text-uppercase text-center text-xl-start py-1 py-xl-0 px-lg-0 px-xl-5">
						{variables.contactBannerRight} <i className="px-1 bi bi-envelope-open"/> {brand.email}
					</Link>
				</div>
			</div>
	);
}





