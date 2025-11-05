import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../../services/api.js";
import "./ProductDetails.css";

export default function ProductDetails() {
	const { id } = useParams();
	const [p, setP] = useState(null);
	useEffect(() => {
		API.get(`/products/${id}`).then((r) => setP(r.data));
	}, [id]);
	if (!p) return <p>Loading...</p>;
	return (
		<div>
			<h1>{p.name}</h1>
			<p>{p.description}</p>
			<p>Price: ${p.price}</p>
			<p>Stock: {p.stock}</p>
		</div>
	);
}
