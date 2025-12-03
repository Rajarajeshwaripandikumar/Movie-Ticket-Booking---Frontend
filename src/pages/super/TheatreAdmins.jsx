// src/pages/super/TheatreAdmins.jsx — polished District / Walmart style
import { useEffect, useMemo, useState, useRef } from "react";
import api from "../../api/api";
import {
  RefreshCcw,
  Search,
  UserRound,
  Mail,
  Building2,
  PencilLine,
  Trash2,
  X,
  Lock,
  Check,
} from "lucide-react";

/* ---------- Config: backend paths ---------- */
const BASE = "/superadmin/theater-admins";
const THEATERS_LIST = "/admin/theaters";

/* ---------- Tiny UI ---------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);

const Field = ({ as = "input", icon: Icon, label, className = "", ...props }) => {
  const C = as;
  return (
    <div>
      {label && <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon && <Icon className="h-4 w-4 text-slate-700" />}
        <C {...props} className={`w-full outline-none bg-transparent text-sm ${className}`} />
      </div>
    </div>
  );
};

export default function TheatreAdmins() {
  const mounted = useRef(true);

  const [admins, setAdmins] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [theatres, setTheatres] = useState([]);
  const theatreOptions = useMemo(
    () => theatres.map((t) => ({ id: t._id || t.id, label: `${t.name} • ${t.city || ""}` })),
    [theatres]
  );

  const [loading, setLoading] = useState(true);

  const searchDebounceRef = useRef(null);

  // Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mounted.current = true;
    loadAdmins();
    loadTheatres();
    return () => {
      mounted.current = false;
      clearTimeout(searchDebounceRef.current);
    };
  }, []);

  async function loadAdmins() {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get(BASE);
      const list = res?.data?.data ?? res?.data ?? [];
      if (!mounted.current) return;
      setAdmins(list);
      setFiltered(list);
    } catch (e) {
      if (!mounted.current) return;
      setErr(e?.response?.data?.message || "Failed to load theatre admins");
      setAdmins([]);
      setFiltered([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function loadTheatres() {
    try {
      const r = await api.get(THEATERS_LIST);
      const arr = Array.isArray(r.data) ? r.data : r.data?.theaters ?? r.data?.data ?? [];
      if (!mounted.current) return;
      setTheatres(arr || []);
    } catch {}
  }

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const s = search.toLowerCase();
      if (!s) return setFiltered(admins);
      setFiltered(
        admins.filter((a) => {
          const nameMatch = (a.name || "").toLowerCase().includes(s);
          const emailMatch = (a.email || "").toLowerCase().includes(s);
          const theatreName = (a.theatreId?.name || "").toLowerCase();
          const theatreCity = (a.theatreId?.city || "").toLowerCase();
          return nameMatch || emailMatch || theatreName.includes(s) || theatreCity.includes(s);
        })
      );
    }, 220);
  }, [search, admins]);

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");

  function openEdit(row) {
    setEditingId(row._id || row.id);
    setName(row.name || "");
    setTheatreId(row.theatreId?._id || "");
    setPassword("");
    setShowModal(true);
    setErr("");
  }

  function closeEdit() {
    setShowModal(false);
    setEditingId("");
    setName("");
    setTheatreId("");
    setPassword("");
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this theatre admin?")) return;
    try {
      await api.delete(`${BASE}/${id}`);
      setAdmins((p) => p.filter((x) => (x._id || x.id) !== id));
      setFiltered((p) => p.filter((x) => (x._id || x.id) !== id));
    } catch (e) {
      setErr("Failed to delete admin");
    }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      const payload = { name, theatreId: theatreId || undefined };
      if (password.trim()) payload.password = password.trim();

      const { data } = await api.put(`${BASE}/${editingId}`, payload);
      const updated = data?.id ? { ...data, _id: data.id } : data;

      setAdmins((list) =>
        list.map((row) => ((row._id || row.id) === editingId ? { ...row, ...updated } : row))
      );
      setFiltered((list) =>
        list.map((row) => ((row._id || row.id) === editingId ? { ...row, ...updated } : row))
      );
      closeEdit();
    } catch {
      setErr("Failed to update admin");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="p-5 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold flex gap-2 items-center">
            <UserRound className="h-6 w-6 text-[#0071DC]" /> Theatre Admins
          </h1>
          <button
            onClick={loadAdmins}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-white hover:bg-slate-100"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 border rounded-xl px-3 py-2">
            <Search className="h-5 w-5 text-slate-600" />
            <input
              placeholder="Search admin or theatre..."
              className="w-full outline-none bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>

        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold p-3 rounded-xl">
            {err}
          </div>
        )}

        <Card className="p-5 overflow-x-auto">
          {loading ? (
            <div className="animate-pulse h-48 rounded bg-slate-100" />
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-4 italic">No theatre admins found.</p>
          ) : (
            <table className="w-full text-sm">
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} /> {/* 🔥 FIXED WIDTH ACTIONS */}
              </colgroup>

              <thead className="border-b bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Theatre</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-3 text-right w-[96px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map((a) => {
                  const id = a._id || a.id;

                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex gap-2 items-center">
                          <div className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center font-bold">
                            {a.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-medium">{a.name}</div>
                            <div className="text-[11px] border px-2 rounded-full">{a.role}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <Mail className="h-4 w-4 text-slate-500" />
                          {a.email}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500" />
                          {a.theatreId?.name || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-3">{fmt(a.createdAt)}</td>

                      <td className="py-3 px-3 whitespace-nowrap w-[96px]">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(a)}
                            className="w-9 h-9 grid place-items-center rounded-full border hover:bg-slate-50"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(id)}
                            className="w-9 h-9 grid place-items-center rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ------- MODAL -------- */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeEdit()}
        >
          <div className="bg-white rounded-2xl border shadow-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-extrabold">Edit Theatre Admin</h3>
              <button onClick={closeEdit} className="w-9 h-9 border rounded-full grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field value={name} onChange={(e) => setName(e.target.value)} label="Name" icon={UserRound} />

              <Field
                as="select"
                value={theatreId}
                icon={Building2}
                onChange={(e) => setTheatreId(e.target.value)}
                label="Theatre"
              >
                <option value="">Unassigned</option>
                {theatreOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Field>

              <Field
                label="New Password (optional)"
                type="password"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {err && <p className="text-xs text-rose-700">{err}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeEdit} className="px-4 py-2 rounded-full border">
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-5 py-2 rounded-full text-white font-semibold bg-[#0071DC] hover:bg-[#0654BA]"
              >
                <Check className="inline h-4 w-4 mr-1" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
