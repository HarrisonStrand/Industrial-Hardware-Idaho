import Header from "../../components/Header/Header";
import ProductCategories from "../../components/ProductCategories/ProductCategories";
import "./Home.css";

export default function Home() {
	return (
	<section className="container-fluid py-0 heroMain py-lg-0 pb-3 px-0 bg-dark">
		<ProductCategories/>
	</section>
	);
}
