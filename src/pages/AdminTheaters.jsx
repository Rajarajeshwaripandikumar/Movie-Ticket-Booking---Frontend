// src/pages/AdminTheaters.jsx — CLEAN + API FIXED + EDIT/DELETE ICONS

import { useEffect, useMemo, useState } from "react";
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
  PencilLine,
} from "lucide-react";

/* UI */
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

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* Helpers */
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'><rect width='100%' height='100%' fill='#e5e7eb'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='12' fill='#6b7280'>No Image</text></svg>`
  );

const parseAmenities = (raw) =>
  !raw ? [] : Array.isArray(raw) ? raw : String(raw).split(",").map((s) => s.trim()).filter(Boolean);

const normalizeTheater = (t = {}) => ({
  ...t,
  amenities: [...new Set(parseAmenities(t.amenities))],
  imageUrl: t.imageUrl || t.poster || t.image || "",
});

export default function AdminTheaters() {
  const { token } = useAuth() || {};
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const [theaters, setTheaters] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [amenityInput, setAmenityInput] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) loadTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadTheaters() {
    try {
      // ✅ include authHeaders; and correct /theaters path (not /theatres)
      const { data } = await api.get("/theaters", {
        headers: authHeaders,
        params: { ts: Date.now() },
      });
      const arr = data?.theaters || data?.data || data;
      setTheaters((Array.isArray(arr) ? arr : []).map(normalizeTheater));
      setMsg("");
    } catch {
      setMsg("⚠️ Failed to load theaters");
      setMsgType("error");
    }
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setCity("");
    setAddress("");
    setAmenitiesList([]);
    setAmenityInput("");
    setImageFile(null);
    setPreview("");
    setPreviewKey((k) => k + 1);
  }

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
    setPreviewKey((k) => k + 1);
  }

  /* Create → POST /theaters/admin */
  async function createTheater(e) {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      setMsg("⚠️ Name & City required");
      setMsgType("error");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("city", city);
      fd.append("address", address);
      amenitiesList.forEach((a) => fd.append("amenities", a));
      if (imageFile) fd.append("image", imageFile);

      const res = await api.post("/theaters/admin", fd, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });
      setTheaters((t) => [normalizeTheater(res.data?.data || res.data), ...t]);
      resetForm();
      setMsg("✅ Theater created!");
      setMsgType("success");
    } catch {
      setMsg("❌ Create failed");
      setMsgType("error");
    }
    setLoading(false);
  }

  /* Update → PUT /theaters/admin/:id */
  async function updateTheaterById() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("city", city);
      fd.append("address", address);
      amenitiesList.forEach((a) => fd.append("amenities", a));
      if (imageFile) fd.append("image", imageFile);

      const res = await api.put(`/theaters/admin/${selectedId}`, fd, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });
      setTheaters((list) =>
        list.map((t) => (t._id === selectedId ? normalizeTheater(res.data?.data || res.data) : t))
      );
      setMsg("✅ Updated!");
      setMsgType("success");
    } catch {
      setMsg("❌ Update failed");
      setMsgType("error");
    }
    setLoading(false);
  }

  /* Delete → DELETE /theaters/admin/:id */
  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      await api.delete(`/theaters/admin/${id}`, { headers: authHeaders });
      setTheaters((t) => t.filter((x) => x._id !== id));
      if (selectedId === id) resetForm();
    } catch {
      setMsg("❌ Delete failed");
      setMsgType("error");
    }
  }

  const names = useMemo(() => [...new Set(theaters.map((t) => t.name))], [theaters]);
  const cities = useMemo(() => [...new Set(theaters.map((t) => t.city))], [theaters]);
  const addresses = useMemo(() => [...new Set(theaters.map((t) => t.address).filter(Boolean))], [theaters]);

  function fillFromTheater(t) {
    t = normalizeTheater(t);
    setSelectedId(t._id);
    setName(t.name || "");
    setCity(t.city || "");
    setAddress(t.address || "");
    setAmenitiesList(t.amenities || []);
    setPreview(t.imageUrl || "");
    setImageFile(null);
    setPreviewKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 py-8 px-4 md:px-6 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-5">
        <Card className="p-5 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold flex gap-2">
            <Building2 className="h-6 w-6" /> Manage Theaters
          </h1>
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

        <div className="grid md:grid-cols-2 gap-5">
          {/* Form */}
          <Card className="p-5 space-y-4">
            <h2 className="text-lg font-extrabold border-b pb-2 flex gap-2">
              <PlusCircle className="h-5 w-5" /> Add / Edit Theater
            </h2>

            <form onSubmit={createTheater} className="space-y-4">
              {selectedId && <p className="text-xs text-slate-600">Editing: {selectedId}</p>}

              <Field
                as="select"
                label="Select Existing Name"
                value={names.includes(name) ? name : ""}
                onChange={(e) => fillFromTheater(theaters.find((t) => t.name === e.target.value))}
                icon={Building2}
              >
                <option value="">—</option>
                {names.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Field>

              <Field label="Theater Name" value={name} onChange={(e) => setName(e.target.value)} icon={Building2} required />

              <Field
                as="select"
                label="Select Existing City"
                value={cities.includes(city) ? city : ""}
                onChange={(e) => fillFromTheater(theaters.find((t) => t.city === e.target.value))}
                icon={MapPin}
              >
                <option value="">—</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Field>

              <Field label="City" value={city} onChange={(e) => setCity(e.target.value)} icon={MapPin} required />

              <Field
                as="select"
                label="Select Existing Address"
                value={addresses.includes(address) ? address : ""}
                onChange={(e) => fillFromTheater(theaters.find((t) => t.address === e.target.value))}
                icon={Home}
              >
                <option value="">—</option>
                {addresses.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Field>

              <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={Home} />

              <label className="block text-xs font-semibold text-slate-600">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {amenitiesList.map((a) => (
                  <span key={a} className="px-2 py-1 text-xs border rounded-full flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" /> {a}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setAmenitiesList(amenitiesList.filter((x) => x !== a))} />
                  </span>
                ))}
              </div>

              <Field
                placeholder="Press Enter to add amenities"
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = amenityInput.trim();
                    if (val && !amenitiesList.includes(val)) setAmenitiesList([...amenitiesList, val]);
                    setAmenityInput("");
                  }
                }}
                icon={ListChecks}
              />

              <label className="text-xs font-semibold">Poster</label>
              <div className="flex gap-3 items-center">
                <img key={previewKey} src={preview || DEFAULT_IMG} className="w-20 h-20 rounded-xl object-cover border" />
                <input type="file" accept="image/*" className="hidden" id="img" onChange={onPickFile} />
                <label htmlFor="img">
                  <SecondaryBtn>
                    <ImageIcon className="h-4 w-4" /> Choose
                  </SecondaryBtn>
                </label>
              </div>

              <div className="flex gap-2">
                <PrimaryBtn type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Create"}
                </PrimaryBtn>
                <PrimaryBtn onClick={updateTheaterById} disabled={!selectedId || loading} className="bg-[#0A66C2] hover:bg-[#0956A3]">
                  <PencilLine className="h-4 w-4" /> Update
                </PrimaryBtn>
                <SecondaryBtn type="button" onClick={resetForm}>
                  Clear
                </SecondaryBtn>
              </div>
            </form>
          </Card>

          {/* List */}
          <Card className="p-5">
            <h2 className="text-lg font-extrabold border-b pb-2 mb-4 flex gap-2">
              <Building2 className="h-5 w-5" /> Existing Theaters
            </h2>

            <ul className="space-y-3 max-h-[60vh] overflow-auto pr-1">
              {theaters.map((t) => (
                <li
                  key={t._id}
                  className={`flex justify-between items-center border rounded-2xl p-3 shadow-sm ${
                    selectedId === t._id ? "ring-2 ring-[#0071DC]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={t.imageUrl || DEFAULT_IMG}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_IMG;
                      }}
                      className="w-14 h-14 rounded-xl object-cover border"
                    />
                    <div>
                      <div className="font-extrabold">{t.name}</div>
                      <div className="text-sm text-slate-700">
                        {t.city} • {t.address || "—"}
                      </div>
                      <div className="text-xs text-slate-500">{t.amenities?.join(" • ") || "No amenities"}</div>
                    </div>
                  </div>

                  {/* Actions: Edit + Delete */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => fillFromTheater(t)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => deleteTheater(t._id)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-rose-300 bg-white hover:bg-rose-50 text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
