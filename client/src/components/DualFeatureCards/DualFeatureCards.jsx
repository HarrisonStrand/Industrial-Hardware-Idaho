import { useContext } from "react";
import { DataContext } from "../../context/DataContext";
import { Link } from "react-router-dom";
import "./DualFeatureCards.css";

export default function DualFeatureCards() {
	const brand = useContext(DataContext);

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
			textAlign: "text-start",
			imgOrder: "",
		},
	];

	return (
		<section className='dual-card-container'>
			<div className='dual-card-overlay container-fluid d-flex justify-content-center align-items-center py-5'>
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
									<div className='col-12 col-lg-6 dual-card-body px-4'>
										<div className='mt-auto w-100 d-flex justify-content-center row'>
											<div className={`mb-4 dual-card-text fs-3 text-main text-uppercase ${card.textAlign}`}>{card.text}</div>
											<Link
												className='text-decoration-none'
												to={card.link}>
												<button id="dual-card-btn" className='dual-card-btn fs-4 text-uppercase w-100 py-4 text-main rounded-4'>
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
