import { useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import { Link } from "react-router-dom";
import './Header.css';

export default function Header(){

	const { theme, toggleTheme } = useContext(ThemeContext);

  return (
		<div className="header bg-main">
			<nav className="navbar navbar-expand-lg container-fluid">
				<div className="container-fluid row g-0 justify-content-lg-between px-3 py-3">
					<div className="col-4 col-lg-6">
						<Link className="fw-semibold text-uppercase d-flex flex-row text-dark align-items-center" to="/">
							<div className="logo header-logo"></div>
							<p className="company-title py-0 my-0 px-3 d-sm-none d-md-flex">Industrial Hardware Idaho</p>
						</Link>
					</div>
					<div className="col-6 text-end d-lg-none d-block">
						<button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
							<span className="navbar-toggler-icon" />
						</button>
					</div>
					<div className="col-4 col-lg-2 align-items-center d-flex justify-content-end">
					<div className="account-icon py-0 my-0 px-3 bi bi-person-circle h2">
					</div>
					<div className="cart-icon py-0 my-0 px-3 text-dark bi bi-bag h2">
					</div>
					</div>
				</div>
			</nav>
					<div className="collapse navbar-collapse" id="navMain">
						<ul className="navbar-nav ms-auto gap-lg-2">
							<li className="nav-item text-uppercase"><Link className="nav-link" to="/products">SHOP NOW</Link></li>
						</ul>
					</div>
		<button onClick={toggleTheme} className="btn btn-outline-light">
        {theme === "light" ? "Dark" : "Light"} Mode
      </button>
		</div>
  ); 
}
