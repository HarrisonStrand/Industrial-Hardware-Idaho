import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import { Link } from "react-router-dom";
import "./DualFeatureCards.css";

export default function DualFeatureCards() {
	const brand = useContext(BrandContext);

	const cards = [
		{
			img: brand.dualCard1Img,
			text: brand.dualCard1Text,
			cta: brand.dualCard1CTA,
			link: "/contact",
			textAlign: "text-center text-lg-start",
			imgOrder: "",
		},
		{
			img: brand.dualCard2Img,
			text: brand.dualCard2Text,
			cta: brand.dualCard2CTA,
			link: "/products",
			textAlign: "text-center text-lg-start",
			imgOrder: "",
		},
	];

	return (
		<section className='dual-card-container'>
			<div className='dual-card-overlay container-fluid d-flex justify-content-center align-items-center py-3 py-lg-5 px-0 px-lg-5'>
				<div className='row g-4 card-row'>
					{cards.map((card, i) => (
						<div key={i} className='col-12 col-lg-6'>
							<div className='dual-card rounded-4 overflow-hidden h-100'>
								<div className='row g-0'>
									<div className={`col-12 col-lg-6 p-0 ${card.imgOrder}`}>
										<img
											src={card.img}
											alt=''
											className='dual-card-img w-100 h-100'
										/>
									</div>
									<div className='col-12 col-lg-6 dual-card-body ps-3 ps-lg-4 py-3 py-lg-4'>
										<div className='mt-auto w-100 d-flex justify-content-center row'>
											<div className={`mb-4 dual-card-text text-main text-uppercase ${card.textAlign}`}>{card.text}</div>
											<Link
												className='text-decoration-none'
												to={card.link}>
												<button id="dual-card-btn" className='dual-card-btn text-uppercase w-100 py-2 py-xl-4 text-main rounded-4'>
													{card.cta}
												</button>
											</Link>
										</div>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
