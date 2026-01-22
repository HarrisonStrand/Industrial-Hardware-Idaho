import { useContext } from "react";
import { Link } from "react-router-dom";
import { BrandContext } from "../../context/BrandContext";
import { VariableContext } from "../../context/VariableContext";
import ContactBanner from "../../components/ContactBanner/ContactBanner";
import "./Careers.css";

export default function Careers() {
	const brand = useContext(BrandContext);
	const variables = useContext(VariableContext);

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Careers
					</div>
					<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-5'>
						<div className='row m-0 pb-2 pb-sm-0'>
							{brand.careerSections.map((section, index) => (
								<div key={index} className='mb-0'>
									{/* Section Title */}
									<div className='career-banner-title text-main text-center text-uppercase fw-regular mb-2'>
										{section.title}
									</div>

									{/* Section Copy */}
									{section.copy.map((line, lineIndex) => (
										<div
											key={lineIndex}
											className='section-copy text-main text-center fw-regular mb-4'>
											{line}
										</div>
									))}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
			<ContactBanner/>
		</>
	);
}
