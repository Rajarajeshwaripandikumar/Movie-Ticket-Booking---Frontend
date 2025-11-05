// src/pages/super/CreateTheatreAdmin.jsx
import { useState } from "react";
import api from "../../api/api";

export default function CreateTheatreAdmin() {
  const [form, setForm] = useState({ name: "", email: "", password: "", theatreId: "" });
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await api.post("/superadmin/create-theatre-admin", form);
      setMsg(res?.data?.message || "Created");
    } catch (e) {
      const code = e?.response?.data?.code;
      const message = e?.response?.data?.message || "Failed";
      setMsg(`${code || "ERROR"}: ${message}`);
    }
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-3 max-w-md">
      <h1 className="font-semibold text-2xl mb-2">Create Theatre Admin</h1>
      <input className="border p-2 w-full" placeholder="Name"
        value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
      <input className="border p-2 w-full" placeholder="Email"
        value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}/>
      <input className="border p-2 w-full" placeholder="Password" type="password"
        value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))}/>
      <input className="border p-2 w-full" placeholder="Theatre ID (ObjectId)"
        value={form.theatreId} onChange={e=>setForm(f=>({...f, theatreId:e.target.value}))}/>
      <button className="px-4 py-2 rounded bg-blue-600 text-white">Create</button>
      {msg ? <div className="text-sm">{msg}</div> : null}
    </form>
  );
}
