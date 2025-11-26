import { Routes, Route, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Header from "./components/Header/Header.jsx";
import Home from "./pages/Home/Home.jsx";
import About from "./pages/About/About.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import Location from "./pages/Location/Location.jsx";
import Orders from "./pages/Orders/Orders.jsx";
import Login from "./pages/Login/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AdminPanel from "./pages/AdminPanel/AdminPanel.jsx";
import ProductList from "./pages/ProductList/ProductList.jsx";
import ProductDetail from "./pages/ProductDetail/ProductDetail.jsx";
import Cart from "./pages/Cart/Cart.jsx";
import Checkout from "./pages/Checkout/Checkout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Footer from "./components/Footer/Footer.jsx"

import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";

library.add(fab, fas, far);

export default function App() {
	const location = useLocation();

	return (
		<main className='main container-fluid position-relative p-0'>
			<Header />
			<AnimatePresence mode='wait'>
				<motion.div
					key={location.pathname + location.search}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.4 }}>
					<Routes location={location} key={location.pathname}>
						<Route path='/' element={<Home />} />
						<Route path='/about' element={<About />} />
						<Route path='/contact' element={<Contact />} />
						<Route path='/location' element={<Location />} />
						<Route path='/orders' element={<Orders />} />
						<Route path='/login' element={<Login />} />
						<Route path='/register' element={<Register />} />
						<Route path='/products/' element={<ProductList />} />
						<Route path='/products/:id' element={<ProductDetail />} />
						<Route path='/products/:categoryId/:subcategoryId' element={<ProductDetail />} />
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
	);
}
