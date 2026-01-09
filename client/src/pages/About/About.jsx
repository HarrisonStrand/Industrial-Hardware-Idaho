import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import "./About.css";
import ContactBanner from "../../components/ContactBanner/ContactBanner";

export default function About() {
	const brand = useContext(BrandContext);

	const cards = [
		{
			img: brand.teamPhoto1,
		},
		{
			img: brand.teamPhoto2,
		},
		{
			img: brand.teamPhoto3,
		},
	];

	return (
		<>
			<div className='container-fluid px-3 px-sm-5 py-4 pt-md-5'>
				<div className='about-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						About Us
					</div>
					<div className='about-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='row m-0'>
							{brand.aboutSec1Copy.map((line, index) => (
								<div
									className='section-copy text-main text-center fw-light mb-1'
									key={index}>
									{line}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className='team-photo-container container-fluid px-3 px-sm-5 py-4 py-md-5'>
				<div className='about-section-container py-4 fade-in rounded-4 px-3 px-sm-5'>
					<div className='text-main text-uppercase mb-1 fs-2 px-0 ps-4'>
						Our Team
					</div>
					<div className='about-detail-container py-4 fade-in rounded-4 px-3 px-sm-5'>
						<div className='row m-0 gap-5 justify-content-center'>
							{cards.map((card, i) => (
								<div
									key={card.img || i}
									className={`col-12 col-sm p-0 ${card.imgOrder}`}>
									<img
										src={card.img}
										alt=''
										className='team-photo dual-card-img w-100 h-100 rounded-4'
									/>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<ContactBanner />
		</>
	);
}
