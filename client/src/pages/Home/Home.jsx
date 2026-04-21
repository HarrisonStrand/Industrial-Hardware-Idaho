import Hero from "../../components/Hero/Hero"
import "./Home.css";
import { useContext } from "react";
import { BrandContext } from "../../context/BrandContext";
import FeatureBanner from "../../components/FeatureBanner/FeatureBanner";
import LogoSlider from "../../components/LogoSlider/LogoSlider";
import DualFeatureCards from "../../components/DualFeatureCards/DualFeatureCards";
import HomeReviews from "../../components/HomeReviews/HomeReviews";

export default function Home() {
  const brand = useContext(BrandContext);

  return (
    <div className="home container-fluid g-0 hero-main">
      <Hero/>
			<FeatureBanner/>
					<div className='hero-title-container m-5 align-items-center d-flex row justify-content-center m-auto py-5 px-0 px-lg-5'>
						<div className='section-title text-main text-center text-uppercase mb-0'>
							{brand.sec2Title}
						</div>
						<div className='main-linebreak border-0 border-top border-main py-2'></div>
						<div className='section-copy text-main text-center fw-light mb-1'>
              {brand.sec2Copy}
						</div>
					</div>
					<LogoSlider/>
					<HomeReviews/>
					<DualFeatureCards/>
    </div>
  );
}
