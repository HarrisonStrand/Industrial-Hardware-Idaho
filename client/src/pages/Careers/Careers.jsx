import { useContext } from "react";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import { VariableContext } from "../../context/VariableContext";
import "./Careers.css";

export default function Careers() {
	const brand = useContext(BrandContext);
	const variables = useContext(VariableContext);

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='career-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Join Our Team!
					</div>
					<div className='career-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='row m-0 pb-2 pb-sm-0'>
							{brand.careerSections.map((section, index) => (
								<div key={index} className='mb-0'>
									{/* Section Title */}
									<div className='section-title text-main text-center fw-regular mb-2'>
										{section.title}
									</div>

									{/* Section Copy */}
									{section.copy.map((line, lineIndex) => (
										<div
											key={lineIndex}
											className='section-copy text-main text-center fw-regular mb-1'>
											{line}
										</div>
									))}
								</div>
							))}
						</div>

						<div className='career-info-container py-0 py-sm-4 px-2 px-sm-0'>
							<div className='career-link-box row align-items-center justify-content-evenly rounded-4 border border-3 border-main py-3 py-sm-2 py-xl-4 px-3 px-xl-5 fw-semibold'>
								<Link
									to={`tel:${brand.phone}`}
									className='career-link text-decoration-none col-12 col-xl-6 align-items-center career-banner-left text-main text-uppercase text-center text-xl-end py-1 py-xl-0 px-lg-0 px-xl-5'>
									{variables.careerBannerLeft}{" "}
									<i className='px-1 bi bi-telephone' /> {brand.phone}
								</Link>
								<Link
									to={`mailto:${brand.email}`}
									className='career-link text-decoration-none col-12 col-xl-6 align-items-center career-banner-right text-main text-uppercase text-center text-xl-start py-1 py-xl-0 px-lg-0 px-xl-5'>
									{variables.careerBannerRight}{" "}
									<i className='px-1 bi bi-envelope-open' /> {brand.email}
								</Link>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
