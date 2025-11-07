import { useEffect, useMemo, useState } from "react";
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
const BASE = "/superadmin/theater-admins"; // ✅ fixed spelling (theater)
const THEATERS_LIST = "/admin/theaters";   // used to populate theatre dropdown

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
  const [admins, setAdmins] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const [theatres, setTheatres] = useState([]);
  const theatreOptions = useMemo(
    () => theatres.map(t => ({ id: t._id || t.id, label: `${t.name} • ${t.city}` })),
    [theatres]
  );

  // Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [password, setPassword] = useState(""); // optional reset

  function openEdit(row) {
    setEditingId(row._id || row.id);
    setName(row.name || "");
    setTheatreId(row.theatreId?._id || row.theatre?.id || "");
    setPassword("");
    setShowModal(true);
  }
  function closeEdit() {
    setShowModal(false);
    setEditingId("");
    setName("");
    setTheatreId("");
    setPassword("");
  }

  async function loadAdmins() {
    try {
      const res = await api.get(BASE);
      const list = res?.data?.data || res?.data || [];
      setAdmins(list);
      setFiltered(list);
      setErr("");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load theatre admins");
    }
  }

  async function loadTheatres() {
    try {
      const r = await api.get(THEATERS_LIST);
      const arr = Array.isArray(r.data) ? r.data : (r.data?.theaters || r.data?.data || []);
      setTheatres(arr || []);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    loadAdmins();
    loadTheatres();
  }, []);

  useEffect(() => {
    const s = search.toLowerCase();
    setFiltered(
      admins.filter(
        (a) =>
          a.name?.toLowerCase().includes(s) ||
          a.email?.toLowerCase().includes(s) ||
          a.theatreId?.name?.toLowerCase().includes(s) ||
          a.theatreId?.city?.toLowerCase().includes(s)
      )
    );
  }, [search, admins]);

  const fmt = (d) => (d ? new Date(d).toLocaleString() : "-");

  async function handleDelete(id) {
    if (!window.confirm("Delete this theatre admin?")) return;
    try {
      await api.delete(`${BASE}/${id}`);
      setAdmins((prev) => prev.filter((x) => (x._id || x.id) !== id));
      setFiltered((prev) => prev.filter((x) => (x._id || x.id) !== id));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to delete admin");
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    try {
      const payload = { name, theatreId };
      if (password.trim()) payload.password = password.trim(); // optional reset

      // If your backend uses PATCH, change put -> patch:
      // const { data } = await api.patch(`${BASE}/${editingId}`, payload);
      const { data } = await api.put(`${BASE}/${editingId}`, payload);

      // normalize id field from API
      const updated = data?.id ? { ...data, _id: data.id } : data;

      setAdmins((prev) =>
        prev.map((row) =>
          (row._id || row.id) === editingId ? { ...row, ...updated, theatreId: updated.theatre || row.theatreId } : row
        )
      );
      setFiltered((prev) =>
        prev.map((row) =>
          (row._id || row.id) === editingId ? { ...row, ...updated, theatreId: updated.theatre || row.theatreId } : row
        )
      );
      closeEdit();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update admin");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Card */}
        <Card className="p-5 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold flex gap-2 items-center">
            <UserRound className="h-6 w-6 text-[#0071DC]" /> Theatre Admins
          </h1>
          <button
            onClick={loadAdmins}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </Card>

        {/* Search */}
        <Card className="p-5">
          <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-[#0071DC]">
            <Search className="h-5 w-5 text-slate-600" />
            <input
              type="text"
              placeholder="Search admin or theatre..."
              className="w-full outline-none text-sm bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </Card>

        {/* Message */}
        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 font-semibold p-3 rounded-xl">
            {err}
          </div>
        )}

        {/* Admins List */}
        <Card className="p-5 overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-slate-500 italic text-center py-4">No theatre admins found.</p>
          ) : (
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>

              <thead className="border-b bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Theatre</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map((a) => {
                  const id = a._id || a.id;
                  const role = a.role || "THEATRE_ADMIN";
                  return (
                    <tr key={id} className="hover:bg-slate-50 align-middle">
                      {/* Name */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 grid place-items-center text-slate-700 font-bold">
                            {a.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate" title={a.name}>
                              {a.name || "—"}
                            </div>
                            <div className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block border border-slate-300 text-slate-700 bg-white">
                              {role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                          <span className="truncate" title={a.email}>
                            {a.email || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Theatre */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                          <span
                            className="truncate"
                            title={
                              a.theatreId?.name
                                ? `${a.theatreId.name}${a.theatreId?.city ? " • " + a.theatreId.city : ""}`
                                : ""
                            }
                          >
                            {a.theatreId?.name ? (
                              <>
                                {a.theatreId.name}
                                {a.theatreId?.city && (
                                  <span className="text-slate-500"> • {a.theatreId.city}</span>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {fmt(a.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(a)}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                            title="Edit"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50"
                            title="Delete"
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

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={(e) => e.target === e.currentTarget && closeEdit()}>
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold">Edit Theatre Admin</h3>
              <button className="w-9 h-9 grid place-items-center rounded-full border hover:bg-slate-50" onClick={closeEdit}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} icon={UserRound} />
              <Field
                as="select"
                label="Theatre"
                value={theatreId}
                onChange={(e) => setTheatreId(e.target.value)}
                icon={Building2}
              >
                <option value="">Select Theatre</option>
                {theatreOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Field>
              <Field
                label="New Password (optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
              />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeEdit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA]"
              >
                <Check className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
