import { NavLink, Outlet } from "react-router-dom";

export default function AdminDashboard() {
  return (
    <div className="container-fluid px-3 px-sm-5 py-4 pt-md-5">
      <div className="theme-section-container py-4 fade-in rounded-4 px-3 px-sm-5">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div className="text-main text-uppercase mb-1 fs-2">Admin Dashboard</div>

          <div className="d-flex gap-2 flex-wrap">
            <NavLink
              to="accounts"
              className={({ isActive }) =>
                `btn rounded-3 ${isActive ? "btn-dark" : "btn-outline-dark"}`
              }
            >
              Accounts
            </NavLink>

            <NavLink
              to="orders"
              className={({ isActive }) =>
                `btn rounded-3 ${isActive ? "btn-dark" : "btn-outline-dark"}`
              }
            >
              Orders
            </NavLink>

            <NavLink
              to="products"
              className={({ isActive }) =>
                `btn rounded-3 ${isActive ? "btn-dark" : "btn-outline-dark"}`
              }
            >
              Products
            </NavLink>
          </div>
        </div>

        <div className="main-linebreak w-100 border-0 border-top border-main py-2 d-none d-sm-block" />

        <div className="theme-detail-container py-3 rounded-4 px-3 px-sm-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}