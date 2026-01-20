import { Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Header from "./components/Header/Header.jsx";
import CartDrawer from "./components/Cart/CartDrawer/CartDrawer.jsx";
import MobileCartBar from "./components/Cart/MobileCartBar/MobileCartBar.jsx";
import { CartProvider } from "./context/CartContext";
import Home from "./pages/Home/Home.jsx";
import About from "./pages/About/About.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import Location from "./pages/Location/Location.jsx";
import Orders from "./pages/Orders/Orders.jsx";
import Careers from "./pages/Careers/Careers.jsx";
import Login from "./pages/Login/Login.jsx";
import SignedOut from "./pages/Auth/SignedOut.jsx";
import Profile from "./pages/Account/Profile.jsx";
import Register from "./pages/Register/Register.jsx";
import ForgotPassword from "./pages/Auth/ForgotPassword.jsx";
import ResetPassword from "./pages/Auth/ResetPassword.jsx";
import Shipping from "./pages/Shipping/Shipping.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AdminPanel from "./pages/AdminPanel/AdminPanel.jsx";
import ProductList from "./pages/ProductList/ProductList.jsx";
import ProductDetail from "./pages/ProductDetail/ProductDetail.jsx";
import Cart from "./pages/Cart/Cart.jsx";
import Checkout from "./pages/Checkout/Checkout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Footer from "./components/Footer/Footer.jsx";

import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";

library.add(fab, fas, far);

export default function App() {
	const location = useLocation();
	const [cartOpen, setCartOpen] = useState(false);

	const routeKey = location.pathname + location.search;

	const [screenWidth, setScreenWidth] = useState(window.innerWidth);

	useEffect(() => {
		const handleResize = () => setScreenWidth(window.innerWidth);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const isMobileCart = screenWidth < 800;

	const noCartOverlayRoutes = ["/cart", "/checkout"];
	const hideCartUI = noCartOverlayRoutes.includes(location.pathname);

	// ✅ KEY FIX: close cart drawer whenever navigation happens,
	// and especially when entering /cart or /checkout
	useEffect(() => {
		setCartOpen(false);
	}, [location.pathname, location.search]);

	return (
		<CartProvider openCart={() => setCartOpen(true)}>
			<main className='main container-fluid position-relative p-0'>
				<Header onCartOpen={() => setCartOpen(true)} />

				{/* Desktop Drawer only (disabled on /cart + /checkout) */}
				{!isMobileCart && !hideCartUI && (
					<CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
				)}

				{/* Mobile bar only (disabled on /cart + /checkout) */}
				{isMobileCart && !hideCartUI && <MobileCartBar />}

				<AnimatePresence mode='wait'>
					<motion.div
						key={routeKey}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4 }}>
						<Routes location={location} key={routeKey}>
							<Route path='/' element={<Home />} />
							<Route path='/location' element={<Location />} />
							<Route path='/about' element={<About />} />
							<Route path='/orders' element={<Orders />} />
							<Route path='/careers' element={<Careers />} />
							<Route path='/contact' element={<Contact />} />
							<Route path='/shipping' element={<Shipping />} />
							<Route path='/login' element={<Login />} />
							<Route path='/signed-out' element={<SignedOut />} />
							<Route
								path='/profile'
								element={
									<ProtectedRoute>
										<Profile />
									</ProtectedRoute>
								}
							/>
							<Route path='/register' element={<Register />} />
							<Route path='/forgot-password' element={<ForgotPassword />} />
							<Route path='/reset-password' element={<ResetPassword />} />
							<Route path='/products/' element={<ProductList />} />
							<Route path='/products/:id' element={<ProductDetail />} />
							<Route
								path='/products/:categoryId/:subcategoryId'
								element={<ProductDetail />}
							/>
							<Route path='/cart' element={<Cart />} />
							<Route path='/checkout' element={<Checkout />} />
							<Route
								path='/dashboard'
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path='/admin'
								element={
									<ProtectedRoute requireAdmin={true}>
										<AdminPanel />
									</ProtectedRoute>
								}
							/>
						</Routes>
					</motion.div>
				</AnimatePresence>

				<Footer />
			</main>
		</CartProvider>
	);
}
