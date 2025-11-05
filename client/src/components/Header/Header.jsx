import { Link } from "react-router-dom";
export default function Header(){
  return (
    <nav className="navbar navbar-expand-lg bg-body shadow-sm">
      <div className="container">
        <Link className="navbar-brand fw-semibold" to="/">Industrial Hardware Idaho</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navMain">
          <ul className="navbar-nav ms-auto gap-lg-2">
            <li className="nav-item"><Link className="nav-link" to="/products">Products</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/about">About</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/contact">Contact</Link></li>
            <li className="nav-item"><Link className="btn btn-primary ms-lg-2" to="/login">Sign In</Link></li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
