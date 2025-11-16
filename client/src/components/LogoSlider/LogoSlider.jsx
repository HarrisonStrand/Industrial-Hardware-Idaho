import "./LogoSlider.css";
import brandLogos from "../../data/brand-logos.json";

export default function LogoSlider() {
  return (
    <div className="logo-slider-container">
      <div className="logo-track">

        {/* First track */}
        {brandLogos.logos.map((logo, i) => (
          <img key={i} src={logo.src} alt={logo.alt} className="logo-item" />
        ))}

        {/* Cloned track (must be identical!) */}
        {brandLogos.logos.map((logo, i) => (
          <img key={`dup-${i}`} src={logo.src} alt={logo.alt} className="logo-item" />
        ))}

      </div>
    </div>
  );
}
