// src/pages/AdminScreens.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import {
  Building2,
  LayoutGrid,
  Rows3,
  Columns3,
  RefreshCcw,
  Trash2,
  PlusCircle,
} from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, label, className = "", ...props }) {
  const C = as;
  return (
    <div>
      {label && (
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
        <C
          {...props}
          className={`w-full outline-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 ${className}`}
        />
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

/* ----------------------------- helpers ----------------------------- */
const NEW = "__new__";
const S = (v) => (v === undefined || v === null ? "" : String(v));

const normalizeScreen = (s = {}) => {
  const rows = Number(s.rows ?? s.row ?? s.r);
  const cols = Number(s.cols ?? s.columns ?? s.col ?? s.c);
  return { ...s, rows: Number.isFinite(rows) ? rows : 0, cols: Number.isFinite(cols) ? cols : 0 };
};

async function fetchScreensForTheater(theaterId) {
  const { data } = await api.get(`/admin/theaters/${theaterId}/screens`);
  const arr = Array.isArray(data) ? data : (data?.data || []);
  return arr.map(normalizeScreen);
}

/* Canonical role mapper */
const canonRole = (r = "") => {
  let v = String(r).toUpperCase().replace("ROLE_", "").trim();
  const map = {
    SUPERADMIN: "SUPER_ADMIN",
    THEATER_ADMIN: "THEATRE_ADMIN",
  };
  return map[v] || v;
};

/* ------------------------------- page ------------------------------- */
export default function AdminScreens() {
  const auth = useAuth() || {};

  const token = auth.token;
  const loading = auth.loading ?? !auth.initialized;
  const isLoggedIn = auth.isLoggedIn ?? auth.isAuthenticated;
  const rawRoles = auth.roles || auth.user?.roles || (auth.role ? [auth.role] : []);

  const roles = useMemo(() => rawRoles.map(canonRole), [rawRoles]);
  const isAdminLike = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(r));

  if (loading) return null;
  if (!token || !isLoggedIn) return <Navigate to="/admin/login" replace />;
  if (!isAdminLike) return <Navigate to="/" replace />;

  const isTheatreAdmin = roles.includes("THEATRE_ADMIN");
  const theatreIdFromJWT =
    auth.user?.theatreId || auth.user?.theatre?.id || auth.user?.theaterId || "";

  const [theaters, setTheaters] = useState([]);
  const [selectedTheater, setSelectedTheater] = useState("");
  const [screens, setScreens] = useState([]);
  const [selectedScreen, setSelectedScreen] = useState(NEW);
  const [screenName, setScreenName] = useState("");
  const [rows, setRows] = useState("");
  const [cols, setCols] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  /* Auto-select theatre for theatre admins */
  useEffect(() => {
    if (isTheatreAdmin && theatreIdFromJWT && !selectedTheater) {
      setSelectedTheater(theatreIdFromJWT);
    }
  }, [isTheatreAdmin, theatreIdFromJWT, selectedTheater]);

  /* Load all theaters */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/theaters`);
        const list = Array.isArray(data) ? data : data?.data || [];
        setTheaters(list);
      } catch {
        setMsgType("error");
        setMsg("Failed to load theaters.");
      }
    })();
  }, []);

  /* Load screens for selected theater */
  useEffect(() => {
    if (!selectedTheater) {
      setScreens([]);
      setSelectedScreen(NEW);
      setScreenName("");
      setRows("");
      setCols("");
      return;
    }

    (async () => {
      try {
        setLoadingScreens(true);
        const list = await fetchScreensForTheater(selectedTheater);
        setScreens(list);
      } catch {
        setMsg("Could not load screens.");
        setMsgType("error");
      } finally {
        setLoadingScreens(false);
      }
    })();
  }, [selectedTheater]);

  /* When selecting screen dropdown */
  useEffect(() => {
    if (selectedScreen === NEW) {
      setScreenName("");
      setRows("");
      setCols("");
      return;
    }

    const s = screens.find((x) => x._id === selectedScreen);
    if (s) {
      setScreenName(S(s.name));
      setRows(S(s.rows));
      setCols(S(s.cols));
    }
  }, [selectedScreen, screens]);

  /* Save / Update */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTheater || !screenName || !rows || !cols) {
      setMsg("Please fill in all fields.");
      setMsgType("error");
      return;
    }

    const r = Number(rows), c = Number(cols);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r <= 0 || c <= 0) {
      setMsg("Rows/Columns must be positive.");
      setMsgType("error");
      return;
    }

    setLoadingAction(true);
    const body = { name: screenName.trim(), rows: r, columns: c, cols: c };

    try {
      if (selectedScreen === NEW) {
        await api.post(`/admin/theaters/${selectedTheater}/screens`, body);
      } else {
        await api.patch(`/admin/theaters/${selectedTheater}/screens/${selectedScreen}`, body);
      }

      const updated = await fetchScreensForTheater(selectedTheater);
      setScreens(updated);

      setMsg(selectedScreen === NEW ? "Screen created!" : "Screen updated!");
      setMsgType("success");
      setSelectedScreen(NEW);
      setScreenName("");
      setRows("");
      setCols("");
    } catch {
      setMsg("Save failed.");
      setMsgType("error");
    } finally {
      setLoadingAction(false);
    }
  }

  /* Delete theatre */
  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      await api.delete(`/admin/theaters/${id}`);
      setTheaters((prev) => prev.filter((t) => t._id !== id));
      if (selectedTheater === id) {
        setSelectedTheater("");
        setScreens([]);
      }
    } catch {
      setMsg("Failed to delete theater.");
      setMsgType("error");
    }
  }

  /* --------------------------- UI --------------------------- */
  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold flex items-center gap-2">
                <Building2 className="h-7 w-7 text-[#0654BA]" />
                Manage Screens
              </h1>
              <p className="text-sm text-slate-600 mt-1">Add or update screens for each theater.</p>
            </div>

            <SecondaryBtn
              onClick={async () => {
                try {
                  const { data } = await api.get(`/admin/theaters`);
                  const list = Array.isArray(data) ? data : data?.data || [];
                  setTheaters(list);
                } catch {}

                if (selectedTheater) {
                  const list = await fetchScreensForTheater(selectedTheater);
                  setScreens(list);
                }
              }}
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </SecondaryBtn>
          </div>
        </Card>

        {msg && (
          <Card
            className={`p-3 font-semibold ${
              msgType === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : msgType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {msg}
          </Card>
        )}

        {/* Form */}
        <Card className="max-w-2xl mx-auto p-5">
          <h2 className="text-lg font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#0654BA]" /> Theater & Screen
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              as="select"
              label="Select Theater"
              value={selectedTheater}
              onChange={(e) => setSelectedTheater(e.target.value)}
              disabled={isTheatreAdmin}
            >
              <option value="">-- Choose a theater --</option>
              {theaters.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.city}
                </option>
              ))}
            </Field>

            {loadingScreens && selectedTheater && (
              <div className="text-xs text-slate-600 mt-1">Loading screens…</div>
            )}

            {selectedTheater ? (
              <Field
                as="select"
                label="Select Screen"
                value={selectedScreen}
                onChange={(e) => setSelectedScreen(e.target.value)}
              >
                <option value={NEW}>➕ Create New Screen</option>
                {screens.map((s) => {
                  const n = normalizeScreen(s);
                  return (
                    <option key={s._id} value={s._id}>
                      {s.name} ({n.rows}×{n.cols})
                    </option>
                  );
                })}
              </Field>
            ) : null}

            <Field
              label="Screen Name"
              placeholder="e.g. Screen 1"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                type="number"
                min="1"
                placeholder="Rows"
                icon={Rows3}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
              />
              <Field
                type="number"
                min="1"
                placeholder="Columns"
                icon={Columns3}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <PrimaryBtn type="submit" disabled={loadingAction}>
                {loadingAction ? "Saving…" : selectedScreen === NEW ? (
                  <>
                    <PlusCircle className="h-4 w-4" /> Create Screen
                  </>
                ) : (
                  "Update Screen"
                )}
              </PrimaryBtn>

              <SecondaryBtn
                type="button"
                onClick={() => {
                  setSelectedScreen(NEW);
                  setScreenName("");
                  setRows("");
                  setCols("");
                }}
              >
                Clear
              </SecondaryBtn>
            </div>
          </form>
        </Card>

        {/* Theater list */}
        <Card className="p-5">
          <h2 className="text-xl font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#0654BA]" /> Available Theaters
          </h2>

          {theaters.length === 0 ? (
            <p className="text-sm text-slate-600">No theaters found.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {theaters.map((t) => (
                <li key={t._id}>
                  <Card className="p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-extrabold">{t.name}</div>
                        <div className="text-sm text-slate-600">
                          {t.city} — {t.address || "No address"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <PrimaryBtn
                          className="px-3 py-1 text-sm"
                          onClick={() => {
                            setSelectedTheater(t._id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Use
                        </PrimaryBtn>

                        <SecondaryBtn
                          className="px-3 py-1 text-sm"
                          onClick={() => deleteTheater(t._id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </SecondaryBtn>
                      </div>
                    </div>

                    {Array.isArray(t.screens) && t.screens.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold mb-1 flex items-center gap-1 text-slate-800">
                          <LayoutGrid className="h-4 w-4" /> Screens
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {t.screens.map((s) => {
                            const n = normalizeScreen(s);
                            return (
                              <span
                                key={s._id}
                                className="text-xs px-2 py-1 rounded-lg border bg-slate-50"
                              >
                                {s.name} — {n.rows}×{n.cols}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
