// src/pages/AdminTheaters.jsx — CLEAN (Theater CRUD only, o1m2 backend)

import { useEffect, useRef, useState, useMemo } from "react";
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

/* -------------------------------------------------------------------------- */
/* UI bits                                                                    */
/* -------------------------------------------------------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", label, ...props }) {
  const C = as;
  return (
    <div>
      {label ? (
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>
      ) : null}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon ? <Icon className="h-4 w-4 text-slate-700" /> : null}
        <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
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
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='12' fill='#6b7280'>No Image</text>
    </svg>
  `);

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
  imageUrl: t.imageUrl || t.poster || t.image || "",
});

const sameStringArray = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).map((s) => s.trim()).sort();
  const sb = [...b].map(String).map((s) => s.trim()).sort();
  return sa.every((v, i) => v === sb[i]);
};

const COMMON_AMENITIES = ["Parking", "Snacks", "AC", "Wheelchair", "3D", "IMAX", "Dolby Atmos"];

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function AdminTheaters() {
  const { token } = useAuth() || {};
  const [theaters, setTheaters] = useState([]);

  // form
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [originalAmenities, setOriginalAmenities] = useState([]);
  const [amenitiesDirty, setAmenitiesDirty] = useState(false);
  const [amenityInput, setAmenityInput] = useState("");

  // image
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  // ui
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  /* Load theaters */
  useEffect(() => {
    if (token) loadTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadTheaters() {
    try {
      const { data } = await api.get("/theaters", {
        params: { page: 1, limit: 500, ts: Date.now() },
      });
      const arr = Array.isArray(data?.theaters) ? data.theaters : Array.isArray(data) ? data : data?.data || [];
      setTheaters(arr.map(normalizeTheater));
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("⚠️ Failed to load theaters (check API base URL)");
      setMsgType("error");
    }
  }

  /* Form helpers */
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
    setImageFile(null);
    setPreview("");
    setPreviewKey((k) => k + 1);
  }

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      setMsg("Only JPG/PNG/WEBP/GIF allowed");
      setMsgType("error");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      setMsg("Max file size is 3MB");
      setMsgType("error");
      return;
    }
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(f);
    setImageFile(f);
    setPreview(url);
    setPreviewKey((k) => k + 1);
  }

  /* Amenities UI */
  function addAmenity(value) {
    const items = String(value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!items.length) return;
    setAmenitiesList((list) => {
      const set = new Set(list);
      items.forEach((i) => set.add(i));
      const next = Array.from(set);
      setAmenitiesDirty(!sameStringArray(next, originalAmenities));
      return next;
    });
  }
  function removeAmenity(value) {
    setAmenitiesList((list) => {
      const next = list.filter((x) => x !== value);
      setAmenitiesDirty(!sameStringArray(next, originalAmenities));
      return next;
    });
  }
  function clearAmenities() {
    setAmenitiesList([]);
    setAmenitiesDirty(!sameStringArray([], originalAmenities));
  }

  /* Create / Update / Delete */
  async function createTheater(e) {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      setMsg("Name and City are required");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      let res;

      if (imageFile) {
        const fd = new FormData();
        fd.append("name", name.trim());
        fd.append("city", city.trim());
        fd.append("address", (address || "").trim());
        if (amenitiesList.length) amenitiesList.forEach((a) => fd.append("amenities", a));
        fd.append("image", imageFile);
        res = await api.post("/theaters", fd, {
          params: { ts: Date.now() },
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const payload = {
          name: name.trim(),
          city: city.trim(),
          address: (address || "").trim(),
          amenities: amenitiesList,
        };
        res = await api.post("/theaters", payload, { params: { ts: Date.now() } });
      }

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
    }
  }

  async function updateTheaterById() {
    if (!selectedId) {
      setMsg("Pick a theater from the list (Use) to update.");
      setMsgType("error");
      return;
    }
    if (!name.trim() || !city.trim()) {
      setMsg("Name and City are required");
      setMsgType("error");
      return;
    }
    setLoading(true);
    try {
      let res;

      if (imageFile) {
        const fd = new FormData();
        fd.append("name", name.trim());
        fd.append("city", city.trim());
        fd.append("address", (address || "").trim());
        if (amenitiesDirty) amenitiesList.forEach((a) => fd.append("amenities", a));
        fd.append("image", imageFile);
        res = await api.put(`/theaters/${selectedId}`, fd, {
          params: { ts: Date.now() },
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        const payload = {
          name: name.trim(),
          city: city.trim(),
          address: (address || "").trim(),
          ...(amenitiesDirty ? { amenities: amenitiesList } : {}),
        };
        res = await api.put(`/theaters/${selectedId}`, payload, {
          params: { ts: Date.now() },
        });
      }

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
      await api.delete(`/theaters/${id}`, { params: { ts: Date.now() } });
      setTheaters((s) => s.filter((t) => t._id !== id));
      if (selectedId === id) resetForm();
      setMsg("🗑️ Theater deleted");
      setMsgType("info");
    } catch (err) {
      const m = err?.response?.data?.message || err.message;
      setMsg("❌ Delete failed: " + m);
      setMsgType("error");
    }
  }

  /* Autocomplete lists (nice-to-have) */
  const names = useMemo(() => [...new Set(theaters.map((t) => t.name))], [theaters]);
  const cities = useMemo(() => [...new Set(theaters.map((t) => t.city))], [theaters]);
  const addresses = useMemo(
    () => [...new Set(theaters.map((t) => t.address || "").filter(Boolean))],
    [theaters]
  );

  function fillFromTheater(raw) {
    const t = normalizeTheater(raw);
    setSelectedId(t._id);
    setName(t.name || "");
    setCity(t.city || "");
    setAddress(t.address || "");
    setAmenitiesList(Array.isArray(t.amenities) ? t.amenities : []);
    setOriginalAmenities(Array.isArray(t.amenities) ? t.amenities : []);
    setAmenitiesDirty(false);
    const url = t.imageUrl || "";
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(url);
    setImageFile(null);
    setPreviewKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSelectName = (val) => {
    setName(val);
    const match =
      theaters.find((t) => t.name === val && t.city === city) ||
      theaters.find((t) => t.name === val);
    if (match) fillFromTheater(match);
  };
  const onSelectCity = (val) => {
    setCity(val);
    const match =
      theaters.find((t) => t.city === val && t.name === name) ||
      theaters.find((t) => t.city === val);
    if (match) fillFromTheater(match);
  };
  const onSelectAddress = (val) => {
    setAddress(val);
    const match = theaters.find((t) => (t.address || "") === val);
    if (match) fillFromTheater(match);
  };

  /* Render */
  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Manage Theaters
            </h1>
            <p className="text-sm text-slate-600 mt-1">Add, edit, or remove theaters.</p>
          </div>
          <SecondaryBtn onClick={loadTheaters}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </SecondaryBtn>
        </Card>

        {/* Messages */}
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
          {/* ---------------- Form ---------------- */}
          <Card className="p-5">
            <h2 className="text-lg font-extrabold tracking-tight border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              <PlusCircle className="h-5 w-5" /> Add / Edit Theater
            </h2>

            <form onSubmit={createTheater} className="space-y-4">
              {selectedId && (
                <div className="text-xs text-slate-600">
                  Editing ID: <span className="font-mono">{selectedId}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Field
                  as="select"
                  label="Select Existing Name"
                  value={names.includes(name) ? name : ""}
                  onChange={(e) => onSelectName(e.target.value)}
                  icon={Building2}
                >
                  <option value="">—</option>
                  {names.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Field>
                <Field
                  label="Theater Name"
                  placeholder="Enter theater name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={Building2}
                  required
                />
              </div>

              {/* City */}
              <div className="space-y-2">
                <Field
                  as="select"
                  label="Select Existing City"
                  value={cities.includes(city) ? city : ""}
                  onChange={(e) => onSelectCity(e.target.value)}
                  icon={MapPin}
                >
                  <option value="">—</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Field>
                <Field
                  label="City"
                  placeholder="Enter city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  icon={MapPin}
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Field
                  as="select"
                  label="Select Existing Address"
                  value={addresses.includes(address) ? address : ""}
                  onChange={(e) => onSelectAddress(e.target.value)}
                  icon={Home}
                >
                  <option value="">—</option>
                  {addresses.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Field>
                <Field
                  label="Address"
                  placeholder="Enter address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  icon={Home}
                />
              </div>

              {/* Amenities */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-slate-600">Amenities</label>

                <div className="flex flex-wrap gap-2">
                  {amenitiesList.length ? (
                    amenitiesList.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 text-xs border border-slate-300 rounded-lg bg-white px-2 py-1"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        {a}
                        <button
                          type="button"
                          onClick={() => removeAmenity(a)}
                          className="ml-1 rounded-full hover:bg-slate-100 p-0.5"
                          aria-label={`Remove ${a}`}
                        >
                          <X className="h-3.5 w-3.5 text-slate-600" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No amenities added</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {COMMON_AMENITIES.map((a) => (
                    <SecondaryBtn key={a} className="text-xs px-2 py-1" onClick={() => addAmenity(a)}>
                      + {a}
                    </SecondaryBtn>
                  ))}
                  {selectedId && (
                    <SecondaryBtn className="text-xs px-2 py-1" onClick={clearAmenities} title="Clear all amenities">
                      Clear amenities
                    </SecondaryBtn>
                  )}
                </div>

                <Field
                  placeholder="Type amenity (or comma list) and press Enter"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAmenity(amenityInput);
                      setAmenityInput("");
                    }
                  }}
                  icon={ListChecks}
                />
              </div>

              {/* Image */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-slate-600">Theater Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-200 border border-slate-200 shadow-sm">
                    <img
                      key={previewKey}
                      src={preview || DEFAULT_IMG}
                      onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                      <SecondaryBtn className="px-3 py-1.5">
                        <ImageIcon className="h-4 w-4" /> Choose Image
                      </SecondaryBtn>
                    </label>
                    {imageFile && (
                      <span className="text-xs text-slate-600">
                        Selected: {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
                      </span>
                    )}
                    <span className="text-xs text-slate-500">JPG/PNG/WEBP/GIF · up to 3MB.</span>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
                <div className="flex gap-2">
                  <PrimaryBtn disabled={loading} type="submit">
                    {loading ? "Saving..." : (
                      <>
                        <PlusCircle className="h-4 w-4" /> Create Theater
                      </>
                    )}
                  </PrimaryBtn>
                  <PrimaryBtn
                    disabled={!selectedId || loading}
                    type="button"
                    onClick={updateTheaterById}
                    className="bg-[#0A66C2] hover:bg-[#0956A3]"
                  >
                    <PencilLine className="h-4 w-4" /> Update Selected
                  </PrimaryBtn>
                </div>
                <SecondaryBtn
                  type="button"
                  onClick={() => {
                    resetForm();
                    setMsg("");
                  }}
                >
                  Clear
                </SecondaryBtn>
              </div>
            </form>
          </Card>

          {/* ---------------- List ---------------- */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold tracking-tight border-b border-slate-200 pb-2 flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Existing Theaters
              </h2>
              <SecondaryBtn onClick={loadTheaters}>
                <RefreshCcw className="h-4 w-4" /> Refresh
              </SecondaryBtn>
            </div>

            {theaters.length === 0 ? (
              <p className="text-sm text-slate-700">No theaters found.</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                {theaters.map((t) => (
                  <li
                    key={t._id}
                    className={`flex justify-between items-center border border-slate-200 bg-white rounded-2xl p-3 shadow-sm ${
                      selectedId === t._id ? "ring-2 ring-[#0071DC]" : ""
                    }`}
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
                        <div className="text-sm text-slate-700">
                          {t.city} — {t.address || "No address"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {Array.isArray(t.amenities) && t.amenities.length > 0
                            ? t.amenities.join(" • ")
                            : "No amenities"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ID: {String(t._id).slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PrimaryBtn onClick={() => fillFromTheater(t)} className="px-3 py-1 text-sm">
                        Use
                      </PrimaryBtn>
                      <SecondaryBtn
                        onClick={() => deleteTheater(t._id)}
                        className="px-3 py-1 text-sm"
                        title="Delete theater"
                      >
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
