// src/pages/AdminTheaters.jsx — Walmart Style (clean, rounded, blue accents)
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

/* Inline fallback image */
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
  const abs = /^https?:\/\//i.test(url) ? url : `${FILES_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
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
    imageUrl: resolveImageUrl(t.imageUrl || t.poster || t.theaterImage || t.image, t.updatedAt) || "",
  };
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function AdminTheaters() {
  const { token, role } = useAuth() || {};
  const [theaters, setTheaters] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [originalAmenities, setOriginalAmenities] = useState([]);
  const [amenitiesDirty, setAmenitiesDirty] = useState(false);
  const [amenityInput, setAmenityInput] = useState("");

  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null); // keep the chosen file for direct multipart create/update

  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  /* Load theaters — choose admin list if admin logged in */
  useEffect(() => {
    loadTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTheaters() {
    try {
      setMsg("");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      // If admin logged in, call admin endpoint to get full list; otherwise public list
      const path = token && role?.toLowerCase() === "admin" ? "/admin/theaters" : "/theaters";
      const res = await api.get(path, { params: { limit: 100, ts: Date.now() }, headers, timeout: 20000 });
      const body = res?.data ?? res;
      let arr = [];

      if (Array.isArray(body.theaters)) arr = body.theaters;
      else if (Array.isArray(body.data)) arr = body.data;
      else if (Array.isArray(body)) arr = body;
      else if (Array.isArray(body?.data?.theaters)) arr = body.data.theaters;
      // final fallback: try known keys
      else if (Array.isArray(body?.theaters?.data)) arr = body.theaters.data;

      setTheaters(arr.map(normalizeTheater));
    } catch (err) {
      console.error("loadTheaters error:", err);
      setMsg("⚠️ Failed to load theaters (check API)");
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
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ------------------- Upload Handler ------------------- */
  // Primary upload: sends file to /api/upload (protected). Keeps flow consistent with existing backend.
  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMsg("Only JPG, PNG, WEBP, or GIF allowed");
      setMsgType("error");
      return;
    }

    // local preview while uploading
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setPreviewKey((k) => k + 1);
    setSelectedFile(file);
    setMsg("Uploading image...");
    setMsgType("info");

    try {
      const fd = new FormData();
      fd.append("image", file);

      // ensure axios doesn't override Content-Type (let browser set boundary)
      try {
        if (api?.defaults?.headers?.post) delete api.defaults.headers.post["Content-Type"];
      } catch (e) {}

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      // Expect upload endpoint at POST /api/upload that returns { url } or { secure_url }
      const { data } = await api.post("/upload", fd, { headers, timeout: 30000 });
      const returnedUrl = data?.url || data?.secure_url || data?.secureUrl || data?.data?.url;
      const abs = resolveImageUrl(returnedUrl, Date.now());
      setPreview(abs || returnedUrl || data?.secure_url || "");
      setMsg("✅ Image uploaded successfully");
      setMsgType("success");
    } catch (err) {
      console.error("Upload failed:", err);
      const serverMsg =
        err?.response?.data?.error || err?.response?.data?.message || err?.response?.data || err?.message;
      setMsg("❌ Upload failed: " + serverMsg);
      setMsgType("error");
    } finally {
      // cleanup local blob URL after a bit — keep preview if upload succeeded (we already set it)
      setTimeout(() => URL.revokeObjectURL(localUrl), 2000);
    }
  }

  /* ------------------- CRUD ------------------- */
  // Helper to prepare headers
  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : undefined);

  // Create
  async function createTheater() {
    if (submittingRef.current) return;
    if (!name.trim() || !city.trim()) {
      setMsg("Name and City required");
      setMsgType("error");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // if a file is selected, use FormData to send image + fields to the admin create endpoint
      if (selectedFile) {
        const fd = new FormData();
        fd.append("image", selectedFile);
        fd.append("name", name);
        fd.append("city", city);
        if (address) fd.append("address", address);
        if (amenitiesList?.length) fd.append("amenities", amenitiesList.join(","));

        try {
          if (api?.defaults?.headers?.post) delete api.defaults.headers.post["Content-Type"];
        } catch (e) {}

        const { data } = await api.post("/admin/theaters", fd, { headers: authHeaders() });
        const created = normalizeTheater(data?.data || data);
        setTheaters((s) => [created, ...s]);
        setMsg("✅ Theater created!");
        setMsgType("success");
        resetForm();
        return;
      }

      // Otherwise, send JSON payload (imageUrl is preview if previously uploaded)
      const payload = {
        name,
        city,
        address,
        amenities: amenitiesList,
        imageUrl: preview,
      };
      const res = await api.post("/admin/theaters", payload, { headers: authHeaders() });
      const created = normalizeTheater(res.data?.data || res.data);
      setTheaters((s) => [created, ...s]);
      setMsg("✅ Theater created!");
      setMsgType("success");
      resetForm();
    } catch (err) {
      console.error("Create theater failed:", err);
      setMsg("❌ Create failed: " + (err?.response?.data?.message || err.message));
      setMsgType("error");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  // Update
  async function updateTheaterById() {
    if (!selectedId) return;
    setLoading(true);
    try {
      // If a new file is selected, send FormData with image to replace
      if (selectedFile) {
        const fd = new FormData();
        fd.append("image", selectedFile);
        fd.append("name", name);
        fd.append("city", city);
        if (address) fd.append("address", address);
        fd.append("amenities", amenitiesDirty ? amenitiesList.join(",") : originalAmenities.join(","));

        try {
          if (api?.defaults?.headers?.post) delete api.defaults.headers.post["Content-Type"];
        } catch (e) {}

        const { data } = await api.put(`/admin/theaters/${selectedId}`, fd, { headers: authHeaders() });
        const updated = normalizeTheater(data?.data || data);
        setTheaters((list) => list.map((t) => (t._id === updated._id ? updated : t)));
        setMsg("✅ Updated successfully");
        setMsgType("success");
        resetForm();
        return;
      }

      // Otherwise send JSON payload
      const payload = {
        name,
        city,
        address,
        amenities: amenitiesDirty ? amenitiesList : originalAmenities,
        imageUrl: preview,
      };
      const res = await api.put(`/admin/theaters/${selectedId}`, payload, { headers: authHeaders() });
      const updated = normalizeTheater(res.data?.data || res.data);
      setTheaters((list) => list.map((t) => (t._id === updated._id ? updated : t)));
      setMsg("✅ Updated successfully");
      setMsgType("success");
      resetForm();
    } catch (err) {
      console.error("Update failed:", err);
      setMsg("❌ Update failed: " + (err?.response?.data?.message || err.message));
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  // Delete
  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      await api.delete(`/admin/theaters/${id}`, { headers: authHeaders() });
      setTheaters((s) => s.filter((t) => t._id !== id));
      setMsg("🗑️ Deleted");
      setMsgType("info");
      // clear form if deleted item was selected
      if (id === selectedId) resetForm();
    } catch (err) {
      console.error("Delete failed:", err);
      setMsg("❌ Delete failed: " + (err?.response?.data?.message || err.message));
      setMsgType("error");
    }
  }

  function fillFromTheater(t) {
    setSelectedId(t._id);
    setName(t.name);
    setCity(t.city);
    setAddress(t.address || "");
    setAmenitiesList(t.amenities || []);
    setOriginalAmenities(t.amenities || []);
    setPreview(t.imageUrl);
    setPreviewKey((k) => k + 1);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ------------------- Render ------------------- */
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-5">
        <Card className="p-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Manage Theaters
            </h1>
            <p className="text-sm text-slate-600">Add, edit, or remove theaters.</p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryBtn
              onClick={() => {
                loadTheaters();
              }}
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </SecondaryBtn>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Image + Theater list */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="p-5">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2 border-b pb-2 border-slate-200">
                <ImageIcon className="h-5 w-5" /> Theater Image
              </h2>
              <div className="flex gap-4 items-center">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-200 border border-slate-200">
                  <img
                    key={previewKey}
                    src={preview || DEFAULT_IMG}
                    onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                    alt="preview"
                    className="object-cover w-full h-full"
                  />
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      onPickFile(e);
                    }}
                    accept="image/*"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-slate-300 bg-white rounded-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <ImageIcon className="h-4 w-4" /> Choose Image
                  </button>
                  <div className="text-xs text-slate-500 mt-2">Tip: small JPG/PNG/WebP &lt;5MB recommended</div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2 border-b pb-2 border-slate-200">
                <Building2 className="h-5 w-5" /> Existing Theaters
              </h2>
              {theaters.length === 0 ? (
                <p className="text-slate-600">No theaters found.</p>
              ) : (
                <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {theaters.map((t) => (
                    <li
                      key={t._id}
                      className={`flex justify-between items-center border border-slate-200 rounded-2xl p-3 shadow-sm ${
                        selectedId === t._id ? "ring-2 ring-[#0071DC]" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <img
                          src={t.imageUrl || DEFAULT_IMG}
                          alt={t.name}
                          className="w-14 h-14 rounded-xl object-cover border"
                        />
                        <div>
                          <div className="font-extrabold">{t.name}</div>
                          <div className="text-sm text-slate-600">{t.city}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryBtn onClick={() => fillFromTheater(t)} className="px-3 py-1 text-sm">
                          Use
                        </PrimaryBtn>
                        <SecondaryBtn onClick={() => deleteTheater(t._id)} className="px-3 py-1 text-sm">
                          <Trash2 className="h-4 w-4" /> Delete
                        </SecondaryBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* RIGHT: Add/Edit Form */}
          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-6">
              <h2 className="font-extrabold text-lg mb-4 flex items-center gap-2 border-b pb-2 border-slate-200">
                <PlusCircle className="h-5 w-5" /> Add / Edit Theater
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createTheater();
                }}
                className="space-y-4"
              >
                <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} icon={Building2} />
                <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} icon={MapPin} />
                <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={Home} />

                {/* Amenities */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1">Amenities</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {amenitiesList.map((a) => (
                      <span key={a} className="px-2 py-1 text-xs border rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-600" /> {a}
                        <X
                          className="h-3 w-3 cursor-pointer text-slate-500"
                          onClick={() => setAmenitiesList(amenitiesList.filter((x) => x !== a))}
                        />
                      </span>
                    ))}
                  </div>
                  <Field
                    placeholder="Type and press Enter"
                    value={amenityInput}
                    onChange={(e) => setAmenityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = amenityInput.trim();
                        if (v && !amenitiesList.includes(v)) {
                          setAmenitiesList([...amenitiesList, v]);
                          setAmenityInput("");
                          setAmenitiesDirty(true);
                        }
                      }
                    }}
                    icon={ListChecks}
                  />
                </div>

                <div className="flex justify-between items-center gap-2 pt-2">
                  <PrimaryBtn type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Create Theater"}
                  </PrimaryBtn>
                  <PrimaryBtn
                    onClick={(e) => {
                      e.preventDefault();
                      updateTheaterById();
                    }}
                    disabled={loading || !selectedId}
                    className="bg-[#0A66C2] hover:bg-[#0956A3]"
                  >
                    Update
                  </PrimaryBtn>
                  <SecondaryBtn
                    onClick={(e) => {
                      e.preventDefault();
                      resetForm();
                    }}
                  >
                    Clear
                  </SecondaryBtn>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
