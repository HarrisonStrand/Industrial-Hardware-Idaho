import "./Hero.css";
import { useContext } from "react";
import CategorySection from "../CategorySection/CategorySection";
import { DataContext } from "../../context/DataContext";

export default function Hero() {
	const brand = useContext(DataContext);

	return (
		<section className='hero-container'>
			<div className='hero-gradient-overlay'>
				<div className='hero-blur-overlay'>
					<div className='hero-categories-wrapper'>
						<CategorySection />
					</div>
					<div className='hero-title-container m-5 px-5 align-items-center d-flex row justify-content-center m-auto'>
						<div className='hero-sec1-title fs-1 text-main text-center text-uppercase mb-0'>
							{brand.sec1Title}
						</div>
						<div className='main-linebreak border-0 border-top border-main py-2'></div>
							{brand.sec1Copy.map((line, index) => (
						<div className='hero-sec1-copy fs-5 text-main text-center fw-light' key={index}>
              {line}
						</div>
							))}
					</div>
				</div>
			</div>
		</section>
	);
}
