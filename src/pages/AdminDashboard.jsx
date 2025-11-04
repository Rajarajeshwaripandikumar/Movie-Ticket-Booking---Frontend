// src/pages/AdminTheaters.jsx — Walmart-style (Super Admin tools + create theatre-admin)
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { Building2, Plus, UserPlus, Trash2, Edit2 } from "lucide-react";

/* ----------------------------- Walmart primitives ---------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);

const Small = ({ children }) => <div className="text-sm text-slate-600">{children}</div>;

const Field = ({ label, children }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);

/* ----------------------------- Page component ----------------------------- */
export default function AdminTheaters() {
  const { token, role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [theaters, setTheaters] = useState([]);
  const [error, setError] = useState("");

  // Create theatre form
  const [tName, setTName] = useState("");
  const [tCity, setTCity] = useState("");
  const [tAddress, setTAddress] = useState("");
  const [creating, setCreating] = useState(false);

  // Create theatre-admin form
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedTheatreId, setSelectedTheatreId] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    if (String(role).toUpperCase() !== "SUPER_ADMIN") {
      setError("Access denied - only Super Admin can manage theaters");
      return;
    }
    loadTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  async function loadTheaters() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/theaters", { headers: { Authorization: `Bearer ${token}` } });
      // axios returns data in res.data
      const data = res?.data || res;
      setTheaters(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
    } catch (err) {
      console.error("[AdminTheaters] load failed", err);
      setError(err?.response?.data?.message || err.message || "Failed to load theaters");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------- create theatre ---------------------- */
  const handleCreateTheatre = async (e) => {
    e?.preventDefault?.();
    if (!tName || !tCity) return setError("Please fill name and city");
    setCreating(true);
    setError("");
    try {
      const res = await api.post("/admin/theaters", { name: tName, city: tCity, address: tAddress }, { headers: { Authorization: `Bearer ${token}` } });
      const newTheatre = res?.data || res;
      setTName(""); setTCity(""); setTAddress("");
      // refresh list
      await loadTheaters();
      setTimeout(() => setError("Theatre created successfully"), 300); // small positive message
    } catch (err) {
      console.error("[AdminTheaters] create theatre failed", err);
      setError(err?.response?.data?.message || err.message || "Failed to create theatre");
    } finally {
      setCreating(false);
    }
  };

  /* ---------------------- create theatre admin ---------------------- */
  const handleCreateTheatreAdmin = async (e) => {
    e?.preventDefault?.();
    if (!adminName || !adminEmail || !adminPassword || !selectedTheatreId) return setError("Please fill all theatre admin fields");
    setCreatingAdmin(true);
    setError("");
    try {
      const payload = { name: adminName, email: adminEmail, password: adminPassword, theatreId: selectedTheatreId };
      const res = await api.post("/superadmin/create-theatre-admin", payload, { headers: { Authorization: `Bearer ${token}` } });
      // success
      setAdminName(""); setAdminEmail(""); setAdminPassword(""); setSelectedTheatreId("");
      setError("Theatre admin created successfully");
      // optionally refresh theatres (if backend returns admin link)
      await loadTheaters();
    } catch (err) {
      console.error("[AdminTheaters] create theatre admin failed", err);
      setError(err?.response?.data?.message || err.message || "Failed to create theatre admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  /* ---------------------- delete theatre (optional) ---------------------- */
  const handleDeleteTheatre = async (id) => {
    if (!confirm("Delete this theatre? This cannot be undone.")) return;
    try {
      await api.del(`/admin/theaters/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      await loadTheaters();
    } catch (err) {
      console.error("[AdminTheaters] delete failed", err);
      setError(err?.response?.data?.message || err.message || "Delete failed");
    }
  };

  /* ---------------------- render ---------------------- */
  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="mb-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0071DC]">Manage Theaters</h1>
                <Small>View, create theaters and create theatre admins (Super Admin only).</Small>
              </div>
              <div className="text-sm text-slate-600">Role: <strong className="uppercase">{role}</strong></div>
            </div>
          </Card>
        </div>

        {/* Two-column layout: list on left, forms on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: List */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">Theaters</h3>
                <div className="text-sm text-slate-500">{loading ? "Loading..." : `${theaters.length} theaters`}</div>
              </div>

              {error && <div className="mb-3 text-sm text-rose-600">{error}</div>}

              {theaters.length === 0 ? (
                <div className="text-sm text-slate-600 p-6">No theaters yet. Create one using the form.</div>
              ) : (
                <ul className="space-y-3">
                  {theaters.map((t) => (
                    <li key={t._id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-slate-600">{t.city} {t.address ? `· ${String(t.address).slice(0,50)}` : ""}</div>
                        {t.admin && <div className="text-[11px] mt-1 text-slate-700">Admin: {t.admin.name || t.admin.email}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button title="Edit" className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-slate-600 hover:bg-slate-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTheatre(t._id)} title="Delete" className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Right: forms */}
          <aside className="space-y-4">
            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#0071DC]" /> Create Theatre</h4>

              <form onSubmit={handleCreateTheatre}>
                <Field label="Name*">
                  <input value={tName} onChange={(e) => setTName(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="e.g. PVR Grand Mall" />
                </Field>

                <Field label="City*">
                  <input value={tCity} onChange={(e) => setTCity(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="City" />
                </Field>

                <Field label="Address">
                  <textarea value={tAddress} onChange={(e) => setTAddress(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="address (optional)" rows={3} />
                </Field>

                <div className="flex gap-2">
                  <button type="submit" disabled={creating} className="flex-1 bg-[#0071DC] text-white py-2 rounded-full font-semibold">
                    {creating ? "Creating..." : (<><Plus className="w-4 h-4 inline-block mr-2" /> Create Theatre</>)}
                  </button>
                  <button type="button" onClick={() => { setTName(""); setTCity(""); setTAddress(""); }} className="px-3 py-2 border rounded-full">Clear</button>
                </div>
              </form>
            </Card>

            <Card className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#0071DC]" /> Create Theatre Admin</h4>

              <form onSubmit={handleCreateTheatreAdmin}>
                <Field label="Admin name">
                  <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="Admin name" />
                </Field>

                <Field label="Admin email">
                  <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="admin@cinema.com" />
                </Field>

                <Field label="Password">
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full p-2 border rounded-xl" placeholder="password (min 6 chars)" />
                </Field>

                <Field label="Assign to Theatre">
                  <select value={selectedTheatreId} onChange={(e) => setSelectedTheatreId(e.target.value)} className="w-full p-2 border rounded-xl">
                    <option value="">Select theatre</option>
                    {theaters.map((t) => <option key={t._id} value={t._id}>{t.name} — {t.city}</option>)}
                  </select>
                </Field>

                <div className="flex gap-2">
                  <button type="submit" disabled={creatingAdmin} className="flex-1 bg-[#0654BA] text-white py-2 rounded-full font-semibold">
                    {creatingAdmin ? "Creating..." : (<><UserPlus className="w-4 h-4 inline-block mr-2" /> Create Admin</>)}
                  </button>
                  <button type="button" onClick={() => { setAdminName(""); setAdminEmail(""); setAdminPassword(""); setSelectedTheatreId(""); }} className="px-3 py-2 border rounded-full">Clear</button>
                </div>
              </form>
            </Card>

          </aside>
        </div>
      </div>
    </main>
  );
}
