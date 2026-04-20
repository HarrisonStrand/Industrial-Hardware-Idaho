import { NavLink, Outlet } from "react-router-dom";

function navButtonClass(isActive) {
	return [
		"rounded-3",
		"text-uppercase",
		"fw-regular",
		"py-2",
		"px-4",
		"text-decoration-none",
		isActive
			? "btn-main-cta text-main-light"
			: "btn-secondary-cta text-main",
	].join(" ");
}

export default function AdminDashboard() {
	return (
		<div className='theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='text-main text-uppercase mb-1 fs-2'>
					Admin Dashboard
				</div>

				<div className='text-muted small mb-3'>
					Manage accounts, orders, products, and pricing from one persistent panel.
				</div>

				<div className='main-linebreak border-0 border-top border-main py-2' />

				<div className='d-flex flex-wrap gap-2 pb-3'>
					<NavLink
						to='/admin/dashboard/accounts'
						className={({ isActive }) => navButtonClass(isActive)}>
						Accounts
					</NavLink>

					<NavLink
						to='/admin/dashboard/orders'
						className={({ isActive }) => navButtonClass(isActive)}>
						Orders
					</NavLink>

					<NavLink
						to='/admin/dashboard/products'
						className={({ isActive }) => navButtonClass(isActive)}>
						Products
					</NavLink>

					<NavLink
						to='/admin/dashboard/pricing'
						className={({ isActive }) => navButtonClass(isActive)}>
						Pricing
					</NavLink>
				</div>

				<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-4'>
					<Outlet />
				</div>
			</div>
		</div>
	);
}