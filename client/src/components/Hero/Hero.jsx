import "./Hero.css";
import CategoryCard from "../CategoryCard/CategoryCard";

export default function Hero() {
  return (
    <section className="hero-container">

      {/* Text Content */}
      <div className="hero-overlay">
        <h1 className="hero-title">Industrial Hardware Idaho</h1>
        <p className="hero-subtitle">Quality Fasteners. Reliable Service.</p>
      </div>

      {/* Categories overlay */}
      <div className="hero-categories-wrapper">
        <CategoryCard />
      </div>
      
    </section>
  );
}
