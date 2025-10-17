// src/pages/AdminTheaters.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useMemo, useRef, useState } from "react";
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
  PencilLine,
  Trash2,
  X,
  Check,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */
const API_BASE = (
  api?.defaults?.baseURL ||
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
).replace(/\/+$/, "");

const FILES_BASE = API_BASE.replace(/\/api$/, "");

// Inline fallback image
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='12' fill='#6b7280'>No Image</text>
    </svg>
  `);

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", label, ...props }) {
  const C = as;
  return (
    <div>
      {label ? <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label> : null}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon ? <Icon className="h-4 w-4 text-slate-700" /> : null}
        <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const resolveImageUrl = (url, updatedAt) => {
  if (!url) return null;
  const abs = /^https?:\/\//i.test(url)
    ? url
    : `${FILES_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  const v = updatedAt ? new Date(updatedAt).getTime() : null;
  return v ? `${abs}${abs.includes("?") ? "&" : "?"}v=${v}` : abs;
};

const normalizeTheater = (t = {}) => {
  const raw = Array.isArray(t.amenities)
    ? t.amenities
    : typeof t.amenities === "string"
    ? t.amenities.split(",")
    : [];
  const amenities = Array.from(new Set(raw.map((a) => String(a).trim()).filter(Boolean)));
  return {
    ...t,
    amenities,
    imageUrl: resolveImageUrl(t.imageUrl || t.poster || t.image, t.updatedAt) || "",
  };
};

const sameStringArray = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).map((s) => s.trim()).sort();
  const sb = [...b].map(String).map((s) => s.trim()).sort();
  return sa.every((v, i) => v === sb[i]);
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function AdminTheaters() {
  const { token, role } = useAuth() || {};
  const [theaters, setTheaters] = useState([]);

  // Form fields
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [originalAmenities, setOriginalAmenities] = useState([]);
  const [amenitiesDirty, setAmenitiesDirty] = useState(false);
  const [amenityInput, setAmenityInput] = useState("");

  // Image upload
  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef(null);

  // Submit guard
  const submittingRef = useRef(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  /* Load theaters */
  useEffect(() => {
    if (token && role?.toLowerCase() === "admin") loadTheaters();
  }, [token, role]);

  async function loadTheaters() {
    try {
      const { data } = await api.get("theaters", { params: { page: 1, limit: 500, ts: Date.now() } });
      const arr = Array.isArray(data?.theaters) ? data.theaters : Array.isArray(data) ? data : [];
      setTheaters(arr.map(normalizeTheater));
      setMsg("");
    } catch (err) {
      console.error("loadTheaters error:", err);
      setMsg("⚠️ Failed to load theaters (check API_BASE)");
      setMsgType("error");
    }
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setCity("");
    setAddress("");
    setAmenitiesList([]);
    setOriginalAmenities([]);
    setAmenitiesDirty(false);
    setAmenityInput("");
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    setPreviewKey((k) => k + 1);
  }

  /* ------------------- Upload Handler ------------------- */
  async function onPickFile(e) {
    const fileInput = e.target;
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMsg("Only JPG/PNG/WEBP/GIF allowed");
      setMsgType("error");
      fileInput.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMsg("Max file size is 3MB");
      setMsgType("error");
      fileInput.value = "";
      return;
    }

    setMsg("Uploading image...");
    setMsgType("info");
    setLoading(true);

    try {
      // match Axios auth
      let authHeader = {};
      try {
        const raw = localStorage.getItem("auth");
        if (raw) {
          const { token } = JSON.parse(raw) || {};
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
      } catch {}

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
        headers: { ...authHeader }, // do not set Content-Type for FormData
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      setPreview(data.url);
      setPreviewKey((k) => k + 1);
      setMsg("✅ Image uploaded successfully");
      setMsgType("success");
    } catch (err) {
      setMsg("❌ Upload failed: " + err.message);
      setMsgType("error");
    } finally {
      setLoading(false);
      fileInput.value = ""; // allow selecting the same file again
    }
  }

  /* ------------------- CRUD ------------------- */
  async function createTheater() {
    if (submittingRef.current) return;
    if (!name.trim() || !city.trim()) {
      setMsg("Name and City are required");
      setMsgType("error");
      return;
    }

    const exists = theaters.some(
      (t) =>
        (t.name || "").trim().toLowerCase() === name.trim().toLowerCase() &&
        (t.city || "").trim().toLowerCase() === city.trim().toLowerCase()
    );
    if (exists) {
      setMsg("A theater with this Name + City already exists.");
      setMsgType("error");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        address: (address || "").trim(),
        amenities: amenitiesList,
        imageUrl: preview,
      };
      const res = await api.post("theaters", payload, {
        params: { ts: Date.now() },
      });
      const created = normalizeTheater(res.data?.data || res.data);
      setTheaters((s) => [created, ...s]);
      setMsg("✅ Theater created!");
      setMsgType("success");
      resetForm();
    } catch (err) {
      const m = err?.response?.data?.error || err?.response?.data?.message || err.message;
      setMsg("❌ Create failed: " + m);
      setMsgType("error");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function updateTheaterById() {
    if (!selectedId) {
      setMsg("Pick a theater first.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        address: (address || "").trim(),
        amenities: amenitiesDirty ? amenitiesList : originalAmenities,
        imageUrl: preview,
      };
      const res = await api.put(`theaters/${selectedId}`, payload, { params: { ts: Date.now() } });
      const updated = normalizeTheater(res.data?.data || res.data);
      setTheaters((list) => list.map((t) => (t._id === updated._id ? updated : t)));
      setMsg("✅ Theater updated.");
      setMsgType("success");
      setOriginalAmenities(updated.amenities || []);
      setAmenitiesDirty(false);
    } catch (err) {
      const m = err?.response?.data?.error || err?.response?.data?.message || err.message;
      setMsg("❌ Update failed: " + m);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      await api.delete(`theaters/${id}`, { params: { ts: Date.now() } });
      setTheaters((s) => s.filter((t) => t._id !== id));
      if (selectedId === id) resetForm();
      setMsg("🗑️ Theater deleted");
      setMsgType("info");
    } catch (err) {
      const m = err?.response?.data?.error || err?.response?.data?.message || err.message;
      setMsg("❌ Delete failed: " + m);
      setMsgType("error");
    }
  }

  function fillFromTheater(tRaw) {
    const t = normalizeTheater(tRaw);
    setSelectedId(t._id);
    setName(t.name || "");
    setCity(t.city || "");
    setAddress(t.address || "");
    setAmenitiesList(t.amenities || []);
    setOriginalAmenities(t.amenities || []);
    setPreview(t.imageUrl || "");
    setPreviewKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ------------------- Render ------------------- */
  return (
    <main className="min-h-screen w-screen bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Manage Theaters
            </h1>
            <p className="text-sm text-slate-600 mt-1">Add, edit, or remove theaters.</p>
          </div>
        <SecondaryBtn onClick={loadTheaters}>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Image upload */}
          <Card className="p-5">
            <h2 className="text-lg font-extrabold border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Theater Image
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-200 border border-slate-200 shadow-sm">
                <img
                  key={previewKey}
                  src={preview || DEFAULT_IMG}
                  onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold border border-slate-300 bg-white hover:bg-slate-50"
                  onClick={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                >
                  <ImageIcon className="h-4 w-4" /> Choose Image
                </button>
                <span className="text-xs text-slate-500">JPG/PNG/WEBP/GIF · up to 3MB</span>
              </div>
            </div>
          </Card>

          {/* Form */}
          <Card className="p-5">
            <h2 className="text-lg font-extrabold border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              <PlusCircle className="h-5 w-5" /> Add / Edit Theater
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTheater();
              }}
              className="space-y-4"
            >
              {selectedId && (
                <div className="text-xs text-slate-600">
                  Editing ID: <span className="font-mono">{selectedId}</span>
                </div>
              )}

              <Field label="Theater Name" value={name} onChange={(e) => setName(e.target.value)} icon={Building2} required />
              <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} icon={MapPin} required />
              <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={Home} />

              {/* Amenities */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-slate-600">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {amenitiesList.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 text-xs border border-slate-300 rounded-lg bg-white px-2 py-1">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {a}
                      <button
                        type="button"
                        onClick={() => {
                          const next = amenitiesList.filter((x) => x !== a);
                          setAmenitiesList(next);
                          setAmenitiesDirty(!sameStringArray(next, originalAmenities));
                        }}
                        className="ml-1 rounded-full hover:bg-slate-100 p-0.5"
                      >
                        <X className="h-3.5 w-3.5 text-slate-600" />
                      </button>
                    </span>
                  ))}
                </div>
                <Field
                  placeholder="Type amenity and press Enter"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = amenityInput.trim();
                      if (v) {
                        const next = Array.from(new Set([...amenitiesList, v]));
                        setAmenitiesList(next);
                        setAmenitiesDirty(!sameStringArray(next, originalAmenities));
                        setAmenityInput("");
                      }
                    }
                  }}
                  icon={ListChecks}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-between items-center pt-1">
                <div className="flex gap-2">
                  <PrimaryBtn disabled={loading} type="submit">
                    {loading ? "Saving..." : (<><PlusCircle className="h-4 w-4" /> Create Theater</>)}
                  </PrimaryBtn>
                  <PrimaryBtn
                    disabled={loading}
                    type="button"
                    onClick={updateTheaterById}
                    className="bg-[#0A66C2] hover:bg-[#0956A3]"
                  >
                    <PencilLine className="h-4 w-4" /> Update
                  </PrimaryBtn>
                </div>
                <SecondaryBtn type="button" onClick={() => { resetForm(); setMsg(""); }}>
                  Clear
                </SecondaryBtn>
              </div>
            </form>
          </Card>

          {/* List */}
          <Card className="p-5">
            <h2 className="text-lg font-extrabold border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Existing Theaters
            </h2>
            {theaters.length === 0 ? (
              <p className="text-sm text-slate-700">No theaters found.</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                {theaters.map((t) => (
                  <li
                    key={t._id}
                    className={`flex justify-between items-center border border-slate-200 bg-white rounded-2xl p-3 shadow-sm ${selectedId === t._id ? "ring-2 ring-[#0071DC]" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-200 shadow-sm">
                        <img
                          src={t.imageUrl || DEFAULT_IMG}
                          onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                          alt={t.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">{t.name}</div>
                        <div className="text-sm text-slate-700">{t.city} — {t.address || "No address"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {Array.isArray(t.amenities) && t.amenities.length ? t.amenities.join(" • ") : "No amenities"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PrimaryBtn onClick={() => fillFromTheater(t)} className="px-3 py-1 text-sm">Use</PrimaryBtn>
                      <SecondaryBtn onClick={() => deleteTheater(t._id)} className="px-3 py-1 text-sm" title="Delete theater">
                        <Trash2 className="h-4 w-4" /> Delete
                      </SecondaryBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
