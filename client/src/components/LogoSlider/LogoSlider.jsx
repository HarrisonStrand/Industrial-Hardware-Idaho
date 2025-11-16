import "./LogoSlider.css";
import brandLogos from "../../data/brand-logos.json";

export default function LogoSlider() {
  return (
    <div className="logo-slider-container">
      <div className="logo-track">
				<div className="logo-track-overlay">
        {brandLogos.logos.map((logo, i) => (
					<img key={i} src={logo.src} alt={logo.alt} className="logo-item" />
        ))}
        {/* Duplicate set for seamless looping */}
        {brandLogos.logos.map((logo, i) => (
					<img key={`dup-${i}`} src={logo.src} alt={logo.alt} className="logo-item" />
        ))}
				</div>
      </div>
    </div>
  );
}
