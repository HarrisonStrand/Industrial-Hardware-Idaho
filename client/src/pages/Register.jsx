import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
export default function Register(){
  const { register } = useAuth();
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [role,setRole]=useState("customer"); const [company,setCompany]=useState("");
  const [err,setErr]=useState(""); const nav=useNavigate();
  const submit=async(e)=>{e.preventDefault(); setErr(""); try{ await register({ name, email, password, role, company }); nav("/dashboard"); }catch(ex){ setErr(ex.response?.data?.message || "Registration failed"); }};
  return (<form onSubmit={submit}><h2>Register</h2>{err && <div style={{color:'crimson'}}>{err}</div>}<input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} /><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/><select value={role} onChange={e=>setRole(e.target.value)}><option value="customer">Customer</option><option value="admin">Admin</option></select><input placeholder="Company" value={company} onChange={e=>setCompany(e.target.value)} /><button type="submit">Create Account</button></form>);
}
