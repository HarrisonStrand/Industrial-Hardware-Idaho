import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api.js";
export default function ProductList(){
  const [items,setItems]=useState([]);
  useEffect(()=>{ API.get("/products").then(r=>setItems(r.data)).catch(()=>setItems([])); },[]);
  return (<div><h1>Products</h1><ul>{items.map(p=>(<li key={p._id}><Link to={`/products/${p._id}`}>{p.name}</Link> - ${p.price}</li>))}</ul></div>);
}
