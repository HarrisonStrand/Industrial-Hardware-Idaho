import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import ScrollToTop from "./components/ScrollToTop/ScrollToTop.jsx";
import Header from "./components/Header/Header.jsx";
import CartDrawer from "./components/Cart/CartDrawer/CartDrawer.jsx";
import MobileCartBar from "./components/Cart/MobileCartBar/MobileCartBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Footer from "./components/Footer/Footer.jsx";

import { CartProvider } from "./context/CartContext";

import Home from "./pages/Home/Home.jsx";
import About from "./pages/About/About.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import Location from "./pages/Location/Location.jsx";
import Careers from "./pages/Careers/Careers.jsx";
import Login from "./pages/Login/Login.jsx";
import SignedOut from "./pages/Auth/SignedOut.jsx";
import Profile from "./pages/Account/Profile.jsx";
import Register from "./pages/Register/Register.jsx";
import ForgotPassword from "./pages/Auth/ForgotPassword.jsx";
import ResetPassword from "./pages/Auth/ResetPassword.jsx";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard.jsx";
import AdminAccounts from "./pages/AdminDashboard/AdminAccounts.jsx";
import AdminOrders from "./pages/AdminDashboard/AdminOrders.jsx";
import AdminProducts from "./pages/AdminDashboard/AdminProducts.jsx";
import AdminPricing from "./pages/AdminDashboard/AdminPricing.jsx";
import ProductList from "./pages/Products/ProductList/ProductList.jsx";
import ProductDetail from "./pages/Products/ProductDetail/ProductDetail.jsx";
import ProductDetailFacetPanel from "./pages/Products/ProductDetail/ProductDetailFacetPanel.jsx";
import CatalogProductRedirect from "./pages/Catalog/CatalogProductRedirect.jsx";
import Cart from "./pages/Cart/Cart.jsx";
import Checkout from "./pages/Checkout/Checkout.jsx";
import PrivacyPolicy from "./pages/Legal/PrivacyPolicy.jsx";
import TermsConditions from "./pages/Legal/TermsConditions.jsx";
import CustomerService from "./pages/Legal/CustomerService.jsx";
import ReturnsExchanges from "./pages/Legal/ReturnsExchanges.jsx";
import ShippingInformation from "./pages/Legal/ShippingInformation.jsx";
import SpecialRequests from "./pages/SpecialRequests/SpecialRequests.jsx";
import OrderConfirmation from "./pages/OrderConfirmation/OrderConfirmation.jsx";
import OrderStatus from "./pages/OrderStatus/OrderStatus.jsx";
import CustomerForms from "./pages/CustomerForms/CustomerForms.jsx";
import VendorInformation from "./pages/VendorInformation/VendorInformation.jsx";

import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";

library.add(fab, fas, far);

export default function App() {
	const location = useLocation();
	const [cartOpen, setCartOpen] = useState(false);
	const [screenWidth, setScreenWidth] = useState(window.innerWidth);

	const isAdminDashboardRoute =
		location.pathname.startsWith("/admin/dashboard");

	const routeKey = isAdminDashboardRoute
		? "/admin/dashboard-shell"
		: location.pathname + location.search;

	useEffect(() => {
		const handleResize = () => setScreenWidth(window.innerWidth);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const isMobileCart = screenWidth < 800;
	const noCartOverlayRoutes = ["/cart", "/checkout"];
	const hideCartUI = noCartOverlayRoutes.includes(location.pathname);

	const openCart = () => setCartOpen(true);
	const closeCart = () => setCartOpen(false);

	return (
		<CartProvider openCart={openCart}>
			<ScrollToTop />

			<div className='app-shell d-flex flex-column min-vh-100'>
				<Header onCartOpen={openCart} />

				<AnimatePresence mode='wait'>
					<motion.main
						key={routeKey}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
						className='flex-grow-1'>
						<Routes>
							<Route path='/' element={<Home />} />
							<Route path='/about' element={<About />} />
							<Route path='/contact' element={<Contact />} />
							<Route path='/location' element={<Location />} />
							<Route path='/careers' element={<Careers />} />
							<Route path='/login' element={<Login />} />
							<Route path='/signed-out' element={<SignedOut />} />
							<Route path='/register' element={<Register />} />
							<Route path='/forgot-password' element={<ForgotPassword />} />
							<Route
								path='/reset-password/:token'
								element={<ResetPassword />}
							/>

							<Route path='/products' element={<ProductList />} />
							<Route
								path='/products/:categoryId/:subcategoryId'
								element={<ProductDetail />}
							/>
							<Route
								path='/products/:categoryId/:subcategoryId/faceted'
								element={<ProductDetailFacetPanel />}
							/>
							<Route
								path='/catalog/product/:slug'
								element={<CatalogProductRedirect />}
							/>

							<Route path='/cart' element={<Cart />} />
							<Route path='/checkout' element={<Checkout />} />
							<Route
								path='/order-confirmation/:orderId'
								element={<OrderConfirmation />}
							/>
							<Route path='/order-status' element={<OrderStatus />} />

							<Route path='/privacy-policy' element={<PrivacyPolicy />} />
							<Route path='/terms-conditions' element={<TermsConditions />} />
							<Route path='/customer-service' element={<CustomerService />} />
							<Route path='/returns-exchanges' element={<ReturnsExchanges />} />
							<Route
								path='/shipping-information'
								element={<ShippingInformation />}
							/>

							<Route path='/special-requests' element={<SpecialRequests />} />
							<Route path='/customer-forms' element={<CustomerForms />} />
							<Route
								path='/vendor-information'
								element={<VendorInformation />}
							/>

							<Route
								path='/profile'
								element={
									<ProtectedRoute>
										<Profile />
									</ProtectedRoute>
								}
							/>

							<Route
								path='/admin'
								element={<Navigate to='/admin/dashboard/accounts' replace />}
							/>

							<Route
								path='/admin/dashboard'
								element={
									<ProtectedRoute requireAdmin>
										<AdminDashboard />
									</ProtectedRoute>
								}>
								<Route index element={<Navigate to='accounts' replace />} />
								<Route path='accounts' element={<AdminAccounts />} />
								<Route path='orders' element={<AdminOrders />} />
								<Route path='products' element={<AdminProducts />} />
								<Route path='pricing' element={<AdminPricing />} />
							</Route>

							<Route
								path='/admin/accounts'
								element={<Navigate to='/admin/dashboard/accounts' replace />}
							/>
							<Route
								path='/admin/orders'
								element={<Navigate to='/admin/dashboard/orders' replace />}
							/>
							<Route
								path='/admin/products'
								element={<Navigate to='/admin/dashboard/products' replace />}
							/>
							<Route
								path='/admin/pricing'
								element={<Navigate to='/admin/dashboard/pricing' replace />}
							/>
						</Routes>
					</motion.main>
				</AnimatePresence>

				<Footer />

				{!hideCartUI && (
					<>
						<CartDrawer isOpen={cartOpen} onClose={closeCart} />
						{isMobileCart && <MobileCartBar onOpenCart={openCart} />}
					</>
				)}
			</div>
		</CartProvider>
	);
}
