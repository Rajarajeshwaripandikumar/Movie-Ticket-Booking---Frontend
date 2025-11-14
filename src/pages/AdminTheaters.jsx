// src/pages/AdminTheaters.jsx — updated (uses activeToken + safer API handling)
import { useEffect, useMemo, useState } from "react";
import api, { API_DEBUG } from "../api/api";
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

/* ----------------------------- UI Primitives ------------------------------ */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", label, ...props }) {
  const C = as;
  return (
    <div>
      {label && (
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon && <Icon className="h-4 w-4 text-slate-700" />}
        <C
          {...props}
          className={`w-full outline-none bg-transparent text-sm ${className}`}
        />
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

/* -------------------------------- Helpers --------------------------------- */
const DEFAULT_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'><rect width='100%' height='100%' fill='#e5e7eb'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='12' fill='#6b7280'>No Image</text></svg>`
  );

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
  _id: t._id || t.id,
  amenities: [...new Set(parseAmenities(t.amenities))],
  imageUrl: t.imageUrl || t.poster || t.image || "",
});

const ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  THEATRE_ADMIN: "THEATRE_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
};

/* ========================================================================= */

export default function AdminTheaters() {
  // prefer centralized flags from AuthContext
  const { activeToken, user, isSuperAdmin: ctxIsSuper, initialized } = useAuth() || {};
  // keep backward-compatible role check too if needed
  const isSuperAdmin = ctxIsSuper || (user && (user.role === ROLE.SUPER_ADMIN || user?.data?.role === ROLE.SUPER_ADMIN));

  const [theaters, setTheaters] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // prefer /theaters first; detection will overwrite if needed
  const [theaterBase, setTheaterBase] = useState("/theaters");

  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [amenityInput, setAmenityInput] = useState("");

  const [preview, setPreview] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);

  // Try immediately and once more shortly after, because role can hydrate async
  useEffect(() => {
    // wait until auth initialized to avoid noisy unauthorized calls
    if (!initialized) {
      // still attempt quick probe in case backend is public
      loadTheaters();
      const t = setTimeout(loadTheaters, 250);
      return () => clearTimeout(t);
    }
    loadTheaters();
    const t = setTimeout(loadTheaters, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, user, initialized]);

  async function tryGet(path) {
    // helper: use activeToken if available
    const opts = {};
    if (activeToken) opts.headers = { Authorization: `Bearer ${activeToken}` };

    // api.getFresh may return res.data or the full response depending on implementation.
    const resp = await api.getFresh(path, opts);
    return resp;
  }

  async function loadTheaters() {
    setMsg("");
    setMsgType("info");
    setListLoading(true);

    try {
      // Expanded list of possible endpoints – covers common spellings & admin variants.
      const order = [
        "/theaters",
        "/theatres",
        "/theaters/mine",
        "/theatres/mine",
        "/theaters/admin/theaters",
        "/theatres/admin/theatres",
        "/theaters/admin/list",
        "/theatres/admin/list",
        "/admin/theaters",
        "/admin/theatres",
        "/superadmin/theaters",
        "/superadmin/theatres",
        "/super/theatre-admins", // sometimes super endpoints
      ];

      let arr = [];
      let chosenBase = "/theaters";

      for (const path of order) {
        try {
          if (API_DEBUG) console.debug("[AdminTheaters] trying", path);
          const resp = await tryGet(path);

          // resp may be already the body or an axios response — normalize:
          const body =
            resp === undefined || resp === null
              ? {}
              : Array.isArray(resp)
              ? resp
              : resp?.data ?? resp;

          // possible shapes
          const tmp =
            (Array.isArray(body) && body) ||
            body?.theaters ||
            body?.data?.theaters ||
            body?.data ||
            body?.items ||
            body?.results ||
            body?.theatres ||
            body?.theatre ||
            [];

          if (Array.isArray(tmp) && tmp.length) {
            arr = tmp;
            // derive canonical base: prefer simple /theaters or /theatres when possible,
            // otherwise use the admin/superadmin path that returned data.
            if (path.includes("/admin") || path.includes("/superadmin") || path.includes("/super")) {
              chosenBase = path.split("?")[0].replace(/\/(theaters|theatres|admin|superadmin|super).*$/i, "/theaters");
            } else {
              chosenBase = path.startsWith("/theatres") ? "/theatres" : "/theaters";
            }
            setTheaterBase(chosenBase);
            if (API_DEBUG) console.debug("[AdminTheaters] success at", path, "count:", tmp.length, "base:", chosenBase);
            break;
          } else if (API_DEBUG) {
            console.debug("[AdminTheaters] no items at", path, "resp shape:", body);
          }
        } catch (err) {
          if (API_DEBUG) {
            console.warn("[AdminTheaters] error at", path, err?.response?.status || err?.message || err);
          }
          // continue to next candidate
        }
      }

      setTheaters((arr || []).map(normalizeTheater));

      if ((!arr || arr.length === 0) && API_DEBUG) {
        console.warn("[AdminTheaters] all theater endpoints tried but no data found");
        setMsg("No theaters returned from any endpoint. Check API & token.");
        setMsgType("error");
      }
    } catch (e) {
      if (API_DEBUG) console.error("[AdminTheaters] load failed:", e);
      setMsg(e?.response?.data?.message || "⚠️ Failed to load theaters. Check API.");
      setMsgType("error");
    } finally {
      setListLoading(false);
    }
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setCity("");
    setAddress("");
    setAmenitiesList([]);
    setAmenityInput("");
    setPreview("");
    setPreviewKey((k) => k + 1);
  }

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setPreviewKey((k) => k + 1);
  }

  /* ------------------------------ CRUD ------------------------------ */
  async function createTheater(e) {
    e.preventDefault();
    if (!name.trim() || !city.trim()) {
      setMsg("⚠️ Name & City required");
      setMsgType("error");
      return;
    }
    if (!isSuperAdmin) {
      setMsg("❌ Only SUPER_ADMIN can create theaters");
      setMsgType("error");
      return;
    }

    setLoading(true);
    try {
      const payload = { name, city, address, amenities: amenitiesList };
      const path = theaterBase || "/theaters";
      const opts = {};
      if (activeToken) opts.headers = { Authorization: `Bearer ${activeToken}` };

      const res = await api.post(path, payload, opts);
      const createdRaw = res?.data ?? res;
      const created = normalizeTheater(createdRaw?.theater || createdRaw);
      setTheaters((t) => [created, ...t]);
      resetForm();
      setMsg("✅ Theater created!");
      setMsgType("success");
    } catch (err) {
      if (API_DEBUG) console.error("[AdminTheaters] create failed:", err);
      const text = err?.response?.data?.message || "❌ Create failed";
      setMsg(text);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  async function updateTheaterById() {
    if (!selectedId) return;
    if (!isSuperAdmin) {
      setMsg("❌ Only SUPER_ADMIN can update theaters");
      setMsgType("error");
      return;
    }

    setLoading(true);
    try {
      const payload = { name, city, address, amenities: amenitiesList };
      const base = theaterBase || "/theaters";
      const opts = {};
      if (activeToken) opts.headers = { Authorization: `Bearer ${activeToken}` };

      const res = await api.put(`${base}/${selectedId}`, payload, opts);
      const raw = res?.data ?? res;
      const upd = normalizeTheater(raw?.theater || raw);
      setTheaters((t) => t.map((x) => (x._id === selectedId ? upd : x)));
      setMsg("✅ Updated!");
      setMsgType("success");
    } catch (err) {
      if (API_DEBUG) console.error("[AdminTheaters] update failed:", err);
      setMsg(err?.response?.data?.message || "❌ Update failed");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTheater(id) {
    if (!isSuperAdmin) {
      setMsg("❌ Only SUPER_ADMIN can delete theaters");
      setMsgType("error");
      return;
    }
    if (!window.confirm("Delete this theater?")) return;

    try {
      const base = theaterBase || "/theaters";
      const opts = {};
      if (activeToken) opts.headers = { Authorization: `Bearer ${activeToken}` };

      await api.delete(`${base}/${id}`, opts);
      setTheaters((t) => t.filter((x) => x._id !== id));
      if (selectedId === id) resetForm();
      setMsg("🗑️ Deleted");
      setMsgType("success");
    } catch (err) {
      if (API_DEBUG) console.error("[AdminTheaters] delete failed:", err);
      setMsg(err?.response?.data?.message || "❌ Delete failed");
      setMsgType("error");
    }
  }

  const names = useMemo(
    () => [...new Set(theaters.map((t) => t.name))],
    [theaters]
  );
  const cities = useMemo(
    () => [...new Set(theaters.map((t) => t.city))],
    [theaters]
  );
  const addresses = useMemo(
    () => [...new Set(theaters.map((t) => t.address).filter(Boolean))],
    [theaters]
  );

  function fillFromTheater(t) {
    t = normalizeTheater(t);
    setSelectedId(t._id);
    setName(t.name || "");
    setCity(t.city || "");
    setAddress(t.address || "");
    setAmenitiesList(t.amenities || []);
    setPreview(t.imageUrl || "");
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing: {isSuperAdmin ? "All theaters" : "Your theaters"}
            </span>
            <SecondaryBtn onClick={loadTheaters}>
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

        <div className="grid md:grid-cols-2 gap-5">
          {/* Form */}
          <Card className="p-5 space-y-4">
            <h2 className="text-lg font-extrabold border-b pb-2 flex gap-2">
              <PlusCircle className="h-5 w-5" /> Add / Edit Theater
            </h2>

            <form onSubmit={createTheater} className="space-y-4">
              {selectedId && (
                <p className="text-xs text-slate-600">Editing: {selectedId}</p>
              )}

              <Field
                as="select"
                label="Select Existing Name"
                value={names.includes(name) ? name : ""}
                onChange={(e) =>
                  fillFromTheater(
                    theaters.find((t) => t.name === e.target.value)
                  )
                }
                icon={Building2}
              >
                <option value="">—</option>
                {names.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Field>

              <Field
                label="Theater Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={Building2}
                required
              />

              <Field
                as="select"
                label="Select Existing City"
                value={cities.includes(city) ? city : ""}
                onChange={(e) =>
                  fillFromTheater(
                    theaters.find((t) => t.city === e.target.value)
                  )
                }
                icon={MapPin}
              >
                <option value="">—</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Field>

              <Field
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                icon={MapPin}
                required
              />

              <Field
                as="select"
                label="Select Existing Address"
                value={addresses.includes(address) ? address : ""}
                onChange={(e) =>
                  fillFromTheater(
                    theaters.find((t) => t.address === e.target.value)
                  )
                }
                icon={Home}
              >
                <option value="">—</option>
                {addresses.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Field>

              <Field
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                icon={Home}
              />

              <label className="block text-xs font-semibold text-slate-600">
                Amenities
              </label>
              <div className="flex flex-wrap gap-2">
                {amenitiesList.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-1 text-xs border rounded-full flex items-center gap-1"
                  >
                    <Check className="h-3 w-3 text-emerald-600" /> {a}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        setAmenitiesList(amenitiesList.filter((x) => x !== a))
                      }
                    />
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
                    if (val && !amenitiesList.includes(val)) {
                      setAmenitiesList([...amenitiesList, val]);
                    }
                    setAmenityInput("");
                  }
                }}
                icon={ListChecks}
              />

              <label className="text-xs font-semibold">Poster (UI only)</label>
              <div className="flex gap-3 items-center">
                <img
                  key={previewKey}
                  src={preview || DEFAULT_IMG}
                  className="w-20 h-20 rounded-xl object-cover border"
                  onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="img"
                  onChange={onPickFile}
                />
                <label htmlFor="img">
                  <SecondaryBtn>
                    <ImageIcon className="h-4 w-4" /> Choose
                  </SecondaryBtn>
                </label>
              </div>

              <div className="flex gap-2">
                <PrimaryBtn type="submit" disabled={loading || !isSuperAdmin}>
                  {loading ? "Saving..." : "Create"}
                </PrimaryBtn>
                <PrimaryBtn
                  onClick={updateTheaterById}
                  disabled={!selectedId || loading || !isSuperAdmin}
                  className="bg-[#0A66C2] hover:bg-[#0956A3]"
                  type="button"
                >
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

            {listLoading ? (
              <div className="text-sm text-slate-500">Loading theaters…</div>
            ) : theaters.length === 0 ? (
              <div className="text-sm text-slate-500">
                No theaters found. Check API routes / role.
              </div>
            ) : (
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
                        onError={(e) => (e.currentTarget.src = DEFAULT_IMG)}
                        className="w-14 h-14 rounded-xl object-cover border"
                      />
                      <div>
                        <div className="font-extrabold">{t.name}</div>
                        <div className="text-sm text-slate-700">
                          {t.city} • {t.address || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.amenities?.join(" • ") || "No amenities"}
                        </div>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fillFromTheater(t)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                        >
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTheater(t._id)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-rose-300 bg-white hover:bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
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
