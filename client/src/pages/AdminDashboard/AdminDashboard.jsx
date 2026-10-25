import { NavLink, Outlet, useLocation } from "react-router-dom";
import "./AdminDashboard.css";

function navButtonClass(isActive) {
	return [
		"rounded-3",
		"text-uppercase",
		"fw-regular",
		"py-2",
		"px-2",
		"text-decoration-none",
		isActive ? "btn-main-cta text-main-light" : "btn-secondary-cta text-main",
	].join(" ");
}

// One line at the top of each tab saying what it is for.
const TAB_HELP = {
	accounts:
		"Review new account requests, set each account's type (Retail, Net 30, House) and give an account its own margin.",
	orders:
		"Review website orders, start processing, mark them completed or deny them, send them to Fishbowl, and archive old ones.",
	products:
		"Search and edit products, fix flagged issues and changes from Fishbowl, and publish products to the site.",
	pricing:
		"Set the margin for each account type. Website prices are calculated from these margins.",
	catalog:
		"Choose which category pages customers can see, edit page titles and layout, and turn the product builder, cart and checkout on or off.",
	reviews:
		"Connect the store's Google listing and sync its Google reviews, which show on the website.",
};

export default function AdminDashboard() {
	const { pathname } = useLocation();
	const tabHelp = TAB_HELP[pathname.split("/")[3]];

	return (
		<div className='theme-detail container-fluid px-3 px-sm-5 py-4 py-md-5'>
			<div className='theme-detail-container py-4 theme-detail fade-in rounded-4 px-3 px-sm-5'>
				<div className='text-main text-uppercase mb-1 fs-2'>
					Admin Dashboard
				</div>

				<div className='text-muted small mb-3'>
					Manage accounts, orders, products, and pricing from one persistent
					panel.
				</div>

				<div className='main-linebreak border-0 border-top border-main py-2' />

				<div className='admin-tab-grid pb-3 text-center'>
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

					<NavLink
						to='/admin/dashboard/catalog'
						className={({ isActive }) => navButtonClass(isActive)}>
						Catalog Layout
					</NavLink>

					<NavLink
						to='/admin/dashboard/reviews'
						className={({ isActive }) => navButtonClass(isActive)}>
						Reviews
					</NavLink>
				</div>

				<div className='theme-detail-container py-3 rounded-4 px-3 px-sm-4'>
					{tabHelp && (
						<div className='text-muted small mb-3'>{tabHelp}</div>
					)}
					<Outlet />
				</div>
			</div>
		</div>
	);
}
