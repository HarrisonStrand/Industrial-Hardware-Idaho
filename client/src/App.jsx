import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home/Home.jsx";
import About from "./pages/About/About.jsx";
import Contact from "./pages/Contact/Contact.jsx";
import Login from "./pages/Login/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AdminPanel from "./pages/AdminPanel/AdminPanel.jsx";
import ProductList from "./pages/ProductList/ProductList.jsx";
import ProductDetails from "./pages/ProductDetails/ProductDetails.jsx";
import Cart from "./pages/Cart/Cart.jsx";
import Checkout from "./pages/Checkout/Checkout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { library } from '@fortawesome/fontawesome-svg-core';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';


export default function App() {

  return (
    <Router>
      <main className="main container-fluid position-relative p-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminPanel /></ProtectedRoute>} />
        </Routes>
      </main>
    </Router>
  );
}

library.add(fab, fas, far);