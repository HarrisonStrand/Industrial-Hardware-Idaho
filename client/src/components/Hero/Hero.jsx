import "./Hero.css";
import { useContext } from "react";
import CategorySection from "../CategorySection/CategorySection";
import { BrandContext } from "../../context/BrandContext";

export default function Hero() {
	const brand = useContext(BrandContext);

	return (
		<section className='hero-container'>
			<div className='hero-gradient-overlay'>
				<div className='hero-blur-overlay'>
					<div className='hero-categories-wrapper'>
						<CategorySection />
					</div>
					<div className='hero-title-container align-items-center d-flex row justify-content-center mx-auto pb-5 pt-3 pt-lg-0 px-lg-5'>
						<div className='section-title text-main text-center text-uppercase mb-0'>
							{brand.sec1Title}
						</div>
						<div className='main-linebreak border-0 border-top border-main py-2'></div>
							{brand.sec1Copy.map((line, index) => (
						<div className='section-copy text-main text-center fw-light mb-1' key={index}>
              {line}
						</div>
							))}
					</div>
				</div>
			</div>
		</section>
	);
}
