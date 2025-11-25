import { useContext } from "react";
import { DataContext } from "../../context/DataContext";
import { Link } from "react-router-dom";
import "./DualFeatureCards.css";

export default function DualFeatureCards() {
	const brand = useContext(DataContext);

	return (
		<section className='dual-card-container'>
			<div className='dual-card-overlay container-fluid d-flex justify-content-center align-items-center py-5'>
				<div className="row justify-content-center m-auto">
					<div className="dual-card rounded-4 px-0 col-6 d-flex">
						<div className="row justify-content-center align-items-center">

						<div className="card-img col col-6">
							<img src={brand.dualCard1Img} className="rounded-4"/>
						</div>
						<div className="card-text-container col col-6">
							<div className="card-1-text fs-4 text-uppercase text-start">
								{brand.dualCard1Text}
							</div>
							<Link className="card-1-btn text-decoration-none" to='/contact'>
								<button className="card-1-btn fs-4 text-uppercase text-center">
									{brand.dualCard1CTA}
								</button>
							</Link>
						</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

				// <div className='dual-card rounded-4 mx-auto px-3 px-md-4 py-3 py-md-4'>
				// 	<div className='row g-5 g-lg-4 align-items-center m-auto'>
				// 		<div className='col-12 col-lg-3 d-flex justify-content-center justify-content-lg-start m-auto order-1 order-md-0 pt-4 pt-md-0 pb-md-3 pb-lg-0'>
				// 		</div>
				// 	</div>
				// </div>
				// <div className='dual-card rounded-4 mx-auto px-3 px-md-4 py-3 py-md-4'>
				// 	<div className='row g-5 g-lg-4 align-items-center m-auto'>
				// 		<div className='col-12 col-lg-3 d-flex justify-content-center justify-content-lg-start m-auto order-1 order-md-0 pt-4 pt-md-0 pb-md-3 pb-lg-0'>
				// 		</div>
				// 	</div>
				// </div>