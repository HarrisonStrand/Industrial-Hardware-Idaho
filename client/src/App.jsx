import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import ProductList from "./pages/ProductList.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Router>
      <nav style={{padding:"0.5rem 1rem", borderBottom:"1px solid #eee"}}>
        <Link to="/">Home</Link>{" | "}
        <Link to="/products">Products</Link>{" | "}
        <Link to="/about">About</Link>{" | "}
        <Link to="/contact">Contact</Link>{" | "}
        <Link to="/login">Login</Link>{" | "}
        <Link to="/register">Register</Link>{" | "}
        <Link to="/dashboard">Dashboard</Link>{" | "}
        <Link to="/admin">Admin</Link>
      </nav>
      <main className="container">
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
