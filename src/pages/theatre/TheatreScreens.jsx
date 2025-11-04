// src/pages/theatre/TheatreScreens.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

export default function TheatreScreens() {
  const { token, user, role } = useAuth();
  const theatreId = user?.theatreId;
  const [screens, setScreens] = useState([]);
  const [name, setName] = useState("");
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(12);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!theatreId || !token) return;
    loadScreens();
    // eslint-disable-next-line
  }, [theatreId, token]);

  async function loadScreens() {
    setLoading(true);
    try {
      const hdr = { headers: { Authorization: `Bearer ${token}` } };
      const res = await api.get(`/admin/theaters/${theatreId}/screens`, hdr);
      const arr = res?.data ?? res;
      setScreens(Array.isArray(arr) ? arr : (arr?.screens || []));
    } catch (err) {
      console.error("loadScreens error", err);
    } finally {
      setLoading(false);
    }
  }

  async function createScreen(e) {
    e?.preventDefault();
    if (!name || !rows || !cols) return;
    try {
      const hdr = { headers: { Authorization: `Bearer ${token}` } };
      await api.post(`/admin/theaters/${theatreId}/screens`, { name, rows: Number(rows), cols: Number(cols) }, hdr);
      setName(""); setRows(8); setCols(12);
      await loadScreens();
    } catch (err) {
      console.error("createScreen err", err);
      alert(err?.response?.data?.message || err.message || "Failed to create screen");
    }
  }

  if (role !== "THEATRE_ADMIN") return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h2 className="text-lg font-bold">Screens for your theatre</h2>
        </Card>

        <Card>
          <form onSubmit={createScreen} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border p-2 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold">Rows</label>
              <input type="number" value={rows} onChange={(e) => setRows(e.target.value)} className="w-full border p-2 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold">Cols</label>
              <input type="number" value={cols} onChange={(e) => setCols(e.target.value)} className="w-full border p-2 rounded-xl" />
            </div>
            <div className="sm:col-span-3 mt-2">
              <button className="bg-[#0071DC] text-white rounded-full px-4 py-2">Create Screen</button>
            </div>
          </form>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Existing Screens</h3>
          {loading ? <div>Loading...</div> : (
            <ul className="space-y-2">
              {screens.map((s) => (
                <li key={s._id} className="p-3 border rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-slate-600">{s.rows} × {s.cols}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
