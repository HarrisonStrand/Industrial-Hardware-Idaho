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
			textAlign: "text-start",
			imgOrder: "order-0",
		},
		{
			img: brand.dualCard2Img,
			text: brand.dualCard2Text,
			cta: brand.dualCard2CTA,
			link: "/products",
			textAlign: "text-center",
			imgOrder: "order-1 order-lg-0",
		},
	];

	return (
		<section className='dual-card-container'>
			<div className='dual-card-overlay container-fluid d-flex justify-content-center align-items-center py-5'>
				<div className='row g-4 card-row'>
					{cards.map((card, i) => (
						<div key={i} className='col-12 col-lg-6'>
							<div className='dual-card d-flex flex-column rounded-4 overflow-hidden h-100'>
								<div className='row g-0 h-100'>
									<div className={`col-6 ${card.imgOrder}`}>
										<img
											src={card.img}
											alt=''
											className='w-100 h-100 object-fit-cover dual-card-img'
										/>
									</div>

									<div className='col-6 d-flex flex-column p-4 h-100'>
										<div className='flex-grow-1 d-none d-lg-block'></div>

										<div
											className={`d-flex flex-column justify-content-center align-items-center ${card.textAlign} my-auto w-100`}>
											<div
												className={`dual-card-text fs-3 text-main text-uppercase mb-4 ${card.textAlign}`}>
												{card.text}
											</div>

											<Link
												className='text-decoration-none w-100'
												to={card.link}>
												<button className='dual-card-btn fs-4 text-uppercase w-100 py-4 text-main rounded-4'>
													{card.cta}
												</button>
											</Link>
										</div>

										<div className='flex-grow-1'></div>
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
