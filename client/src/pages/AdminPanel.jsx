import { useEffect, useState } from "react";
import API from "../services/api.js";
export default function AdminPanel(){
  const [items,setItems]=useState([]);
  const [form,setForm]=useState({ name:"", price:0, stock:0, category:"", description:"" });
  const load=()=> API.get("/products").then(r=>setItems(r.data));
  useEffect(()=>{ load(); },[]);
  const create=async(e)=>{ e.preventDefault(); await API.post("/products", form); setForm({ name:"", price:0, stock:0, category:"", description:"" }); load(); };
  const del=async(id)=>{ await API.delete(`/products/${id}`); load(); };
  return (<div><h2>Admin Panel</h2><form onSubmit={create}><input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/><input type="number" placeholder="Price" value={form.price} onChange={e=>setForm({...form, price:Number(e.target.value)})}/><input type="number" placeholder="Stock" value={form.stock} onChange={e=>setForm({...form, stock:Number(e.target.value)})}/><input placeholder="Category" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}/><input placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/><button type="submit">Create Product</button></form><ul>{items.map(p=>(<li key={p._id}>{p.name} - ${p.price} <button onClick={()=>del(p._id)}>Delete</button></li>))}</ul></div>);
}
