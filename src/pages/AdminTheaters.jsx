// src/pages/AdminTheaters.jsx — FULL UPDATED FOR BACKEND o1m2

import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  MapPin,
  Home,
  ListChecks,
  Image as ImageIcon,
  RefreshCcw,
  PlusCircle,
  Trash2,
  X,
  Check,
  UserRound,
  Mail,
  Lock,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* BASE URL (Your backend is o1m2, so we use it directly)                     */
/* -------------------------------------------------------------------------- */
const API_BASE = (
  api?.defaults?.baseURL ||
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
).replace(/\/+$/, "");

const FILES_BASE = API_BASE.replace(/\/api$/, "");
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='12' fill='#6b7280'>No Image</text>
    </svg>
  `);

/* --------------------------- Walmart UI Components ----------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", label, ...props }) {
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
}

function PrimaryBtn({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------- Helpers --------------------------- */
const resolveImageUrl = (url, updatedAt) => {
  if (!url) return null;
  const abs = /^https?:\/\//i.test(url) ? url : `${FILES_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  const v = updatedAt ? new Date(updatedAt).getTime() : null;
  return v ? `${abs}${abs.includes("?") ? "&" : "?"}v=${v}` : abs;
};

const parseAmenities = (raw) =>
  !raw
    ? []
    : Array.isArray(raw)
    ? raw
    : String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

const normalizeTheater = (t = {}) => ({
  ...t,
  amenities: parseAmenities(t.amenities),
  imageUrl: resolveImageUrl(t.imageUrl || t.poster || t.theaterImage || t.image, t.updatedAt),
});

/* Decode JWT to gate super-only UI */
function parseJwt(token) {
  try {
    const base = token.split(".")[1];
    return JSON.parse(atob(base.replace(/-/g, "+").replace(/_/g, "/"))) || {};
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                 */
/* -------------------------------------------------------------------------- */
export default function AdminTheaters() {
  const { token } = useAuth();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const claims = token ? parseJwt(token) : {};
  const role = String(claims?.role || "").toUpperCase();
  const isSuper = role === "SUPER_ADMIN";

  const [theaters, setTheaters] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminsEnabled, setAdminsEnabled] = useState(false); // derive from role + API success

  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [amenitiesList, setAmenitiesList] = useState([]);
  const [amenityInput, setAmenityInput] = useState("");

  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);

  /* ------- Theatre Admin Creation Form ------- */
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  /* Load theaters */
  async function loadTheaters() {
    try {
      const res = await api.get("/theaters", { headers: authHeaders });
      const arr = res?.data?.data || res?.data?.theaters || res?.data || [];
      setTheaters(arr.map(normalizeTheater));
    } catch (err) {
      console.error(err);
      setMsg("⚠️ Failed to load theaters");
      setMsgType("error");
    }
  }

  /* Load admins (SUPER only) */
  async function loadAdmins() {
    if (!isSuper) {
      setAdmins([]);
      setAdminsEnabled(false);
      return;
    }
    try {
      const res = await api.get("/superadmin/theatre-admins", { headers: authHeaders });
      const arr = res?.data?.data || [];
      setAdmins(arr);
      setAdminsEnabled(true);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setAdmins([]);
        setAdminsEnabled(false);
      } else {
        // keep UI smooth but show a friendly banner
        setMsg("⚠️ Failed to load theatre admins");
        setMsgType("error");
        setAdminsEnabled(false);
      }
    }
  }

  useEffect(() => {
    loadTheaters();
    loadAdmins(); // will no-op if not super
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, token]);

  /* Select file */
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setPreviewKey((k) => k + 1);
  };

  /* Create Theater */
  async function createTheater() {
    if (!name.trim() || !city.trim()) {
      setMsg("⚠️ Name and City required");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      let body;
      if (selectedFile) {
        body = new FormData();
        body.append("image", selectedFile);
        body.append("name", name);
        body.append("city", city);
        if (address) body.append("address", address);
        body.append("amenities", JSON.stringify(amenitiesList));
      } else {
        body = { name, city, address, amenities: amenitiesList };
      }
      await api.post("/theaters/admin", body, { headers: authHeaders });
      resetForm();
      await loadTheaters();
      setMsg("✅ Theater created!");
      setMsgType("success");
    } catch (err) {
      const status = err?.response?.status;
      const m = err?.response?.data?.message || "Failed to create theater";
      if (status === 401) {
        setMsg("🔑 Session expired. Please log in again.");
      } else {
        setMsg(`❌ ${m}`);
      }
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  /* Update */
  async function updateTheaterById() {
    if (!selectedId) return;
    setLoading(true);
    try {
      let body;
      if (selectedFile) {
        body = new FormData();
        body.append("image", selectedFile);
        body.append("name", name);
        body.append("city", city);
        if (address) body.append("address", address);
        body.append("amenities", JSON.stringify(amenitiesList));
      } else {
        body = { name, city, address, amenities: amenitiesList };
      }
      await api.put(`/theaters/admin/${selectedId}`, body, { headers: authHeaders });
      resetForm();
      await loadTheaters();
      setMsg("✅ Updated successfully!");
      setMsgType("success");
    } catch (err) {
      const status = err?.response?.status;
      const m = err?.response?.data?.message || "Update failed";
      if (status === 401) {
        setMsg("🔑 Session expired. Please log in again.");
      } else {
        setMsg(`❌ ${m}`);
      }
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  /* Delete */
  async function deleteTheater(id) {
    if (!window.confirm("Delete this theater?")) return;
    try {
      await api.delete(`/theaters/admin/${id}`, { headers: authHeaders });
      await loadTheaters();
    } catch (err) {
      const m = err?.response?.data?.message || "Delete failed";
      setMsg(`❌ ${m}`);
      setMsgType("error");
    }
  }

  /* Reset Form */
  function resetForm() {
    setSelectedId(null);
    setName("");
    setCity("");
    setAddress("");
    setAmenitiesList([]);
    setPreview("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* Fill Form for Edit */
  function fillFromTheater(t) {
    setSelectedId(t._id);
    setName(t.name || "");
    setCity(t.city || "");
    setAddress(t.address || "");
    setAmenitiesList(t.amenities || []);
    setPreview(t.imageUrl || "");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* Reset Theatre Admin Password (SUPER only) */
  async function resetAdminPassword(adminId) {
    if (!isSuper) {
      setMsg("🔒 Only Super Admin can reset admin passwords.");
      setMsgType("error");
      return;
    }
    const newPassword = window.prompt("Enter a new password for this admin:");
    if (!newPassword) return;
    try {
      const res = await api.post(
        "/superadmin/admin/reset-password",
        { adminId, newPassword },
        { headers: authHeaders }
      );
      setMsg("✅ " + (res?.data?.message || "Password reset"));
      setMsgType("success");
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || "Failed to reset password";
      if (status === 401 || status === 403) {
        setMsg("🔒 Not authorized to reset passwords.");
      } else {
        setMsg(`❌ ${serverMsg}`);
      }
      setMsgType("error");
    }
  }

  /* Create Theatre Admin (SUPER only + detailed 409 messaging) */
  async function createTheatreAdmin() {
    if (!isSuper) {
      setMsg("🔒 Only Super Admin can create theatre admins.");
      setMsgType("error");
      return;
    }
    if (!selectedId) {
      setMsg("⚠️ Select a theatre first.");
      setMsgType("error");
      return;
    }
    if (!adminName || !adminEmail || !adminPassword) {
      setMsg("⚠️ Name, Email, Password required");
      setMsgType("error");
      return;
    }
    try {
      await api.post(
        "/superadmin/create-theatre-admin",
        { name: adminName, email: adminEmail, password: adminPassword, theatreId: selectedId },
        { headers: authHeaders }
      );
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      await loadAdmins();
      setMsg("✅ Theatre Admin Created");
      setMsgType("success");
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      if (status === 409 && code === "EMAIL_TAKEN") {
        setMsg("❌ Email already exists. Use a different email.");
      } else if (status === 409 && code === "THEATER_ALREADY_HAS_ADMIN") {
        setMsg("❌ This theatre already has an admin.");
      } else if (status === 401 || status === 403) {
        setMsg("🔒 Not authorized to create theatre admins.");
      } else {
        setMsg(`❌ ${serverMsg || "Failed to create theatre admin"}`);
      }
      setMsgType("error");
      console.error("[createTheatreAdmin]", { status, data: err?.response?.data });
    }
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-5">
        <Card className="p-5 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold flex gap-2">
            <Building2 className="h-6 w-6" /> Manage Theaters
          </h1>
          <SecondaryBtn onClick={() => { loadTheaters(); loadAdmins(); }}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </SecondaryBtn>
        </Card>

        {msg && (
          <Card
            className={`p-3 font-semibold ${
              msgType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : msgType === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {msg}
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5">
              <h2 className="font-extrabold mb-4 flex items-center gap-2 border-b pb-2">
                <ImageIcon className="h-5 w-5" /> Theaters
              </h2>

              {theaters.length === 0 ? <p>No theaters yet.</p> : (
                <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {theaters.map((t) => (
                    <li key={t._id} className="flex justify-between items-center border rounded-2xl p-3 shadow-sm">
                      <div className="flex gap-3">
                        <img src={t.imageUrl || DEFAULT_IMG} className="w-14 h-14 rounded-xl object-cover border" alt="" />
                        <div>
                          <div className="font-bold">{t.name}</div>
                          <div className="text-sm text-slate-600">{t.city}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryBtn onClick={() => fillFromTheater(t)} className="px-3 py-1 text-sm">Use</PrimaryBtn>
                        <SecondaryBtn onClick={() => deleteTheater(t._id)} className="px-3 py-1 text-sm">
                          <Trash2 className="h-4 w-4" /> Delete
                        </SecondaryBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Admins list (SUPER only; shows when API succeeded) */}
            {isSuper && adminsEnabled && (
              <Card className="p-5">
                <h2 className="font-extrabold mb-4 flex items-center gap-2 border-b pb-2">
                  <UserRound className="h-5 w-5" /> Theatre Admins
                </h2>
                {admins.length === 0 ? (
                  <p>No theatre admins yet.</p>
                ) : (
                  <ul className="space-y-3 max-h-[40vh] overflow-y-auto">
                    {admins.map((a) => (
                      <li key={a._id} className="flex justify-between items-center border rounded-2xl p-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200 grid place-items-center font-bold text-slate-600">
                            {String(a?.name || a?.email || "A").slice(0,1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold">{a.name}</div>
                            <div className="text-sm text-slate-600 flex items-center gap-2">
                              <Mail className="h-3 w-3" /> {a.email}
                            </div>
                            <div className="text-xs text-slate-500">
                              Theatre: {a?.theatreId?.name} {a?.theatreId?.city ? `• ${a.theatreId.city}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SecondaryBtn onClick={() => resetAdminPassword(a._id)} className="px-3 py-1 text-xs">
                            <Lock className="h-3 w-3" /> Reset Password
                          </SecondaryBtn>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          {/* Add/Edit Form */}
          <div>
            <Card className="p-5 sticky top-6 space-y-4">
              <h2 className="font-extrabold text-lg flex items-center gap-2 border-b pb-2">
                <PlusCircle className="h-5 w-5" /> Add / Edit
              </h2>

              <div>
                <label className="text-[12px] font-semibold mb-1 block">Poster</label>
                <div className="flex gap-3 items-center">
                  <img key={previewKey} src={preview || DEFAULT_IMG} className="w-20 h-20 rounded-xl object-cover border" alt="" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 border rounded-full text-sm">
                    <ImageIcon className="h-4 w-4" /> Choose
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                </div>
              </div>

              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} icon={Building2} />
              <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} icon={MapPin} />
              <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={Home} />

              <div>
                <label className="text-[12px] font-semibold mb-1">Amenities</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {amenitiesList.map((a) => (
                    <span key={a} className="px-2 py-1 text-xs border rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-600" /> {a}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setAmenitiesList((x) => x.filter((y) => y !== a))} />
                    </span>
                  ))}
                </div>
                <Field
                  placeholder="Press Enter to add"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = amenityInput.trim();
                      if (v && !amenitiesList.includes(v)) setAmenitiesList([...amenitiesList, v]);
                      setAmenityInput("");
                    }
                  }}
                  icon={ListChecks}
                />
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <PrimaryBtn onClick={createTheater} disabled={loading}>
                  {loading ? "Saving..." : "Create"}
                </PrimaryBtn>
                <PrimaryBtn onClick={updateTheaterById} disabled={!selectedId || loading} className="bg-[#0A66C2] hover:bg-[#0956A3]">
                  Update
                </PrimaryBtn>
                <SecondaryBtn onClick={resetForm}>Clear</SecondaryBtn>
              </div>
            </Card>
          </div>
        </div>

        {/* Create Theatre Admin (SUPER only; show only if admins panel enabled) */}
        {isSuper && adminsEnabled && (
          <Card className="p-5 mt-6">
            <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2 border-b pb-2">
              <UserRound className="h-5 w-5" /> Create Theatre Admin
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Full Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} icon={UserRound} />
              <Field label="Email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} icon={Mail} />
              <Field label="Password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} icon={Lock} />
            </div>

            <PrimaryBtn className="mt-4" onClick={createTheatreAdmin} disabled={!selectedId || !isSuper}>
              Create Theatre Admin (Select a theatre first)
            </PrimaryBtn>
          </Card>
        )}
      </div>
    </main>
  );
}
