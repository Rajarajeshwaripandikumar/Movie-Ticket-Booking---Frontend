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
          className={`w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 ${className}`}
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
  const rows = s.rows ?? s.row ?? (Number.isFinite(+s.r) ? +s.r : undefined);
  const cols =
    s.cols ?? s.columns ?? s.col ?? (Number.isFinite(+s.c) ? +s.c : undefined);
  return { ...s, rows: rows ?? undefined, cols: cols ?? undefined };
};

async function fetchScreensForTheater(theaterId) {
  const ts = Date.now();
  // ✅ matches backend screens.routes mount under /api
  const { data } = await api.get(`/admin/theaters/${theaterId}/screens?ts=${ts}`);
  const arr = Array.isArray(data) ? data : (data?.data || []);
  return arr.filter(Boolean).map(normalizeScreen);
}

async function updateScreenApi(theaterId, screenId, body) {
  try {
    return await api.patch(`/admin/theaters/${theaterId}/screens/${screenId}`, body);
  } catch (e) {
    if (e?.response?.status === 405) {
      return await api.put(`/admin/theaters/${theaterId}/screens/${screenId}`, body);
    }
    throw e;
  }
}

/* Canonical role helper (THEATRE_ADMIN is canonical) */
const canonRole = (r) => {
  if (r == null) return null;
  let v = String(r).trim().toUpperCase().replace(/\s+/g, "_");
  if (v.startsWith("ROLE_")) v = v.slice(5);
  const map = {
    THEATER_ADMIN: "THEATRE_ADMIN",
    THEATRE_MANAGER: "THEATRE_ADMIN",
    THEATER_MANAGER: "THEATRE_ADMIN",
    PVR_MANAGER: "THEATRE_ADMIN",
    PVR_ADMIN: "THEATRE_ADMIN",
    SUPERADMIN: "SUPER_ADMIN",
  };
  return map[v] ?? v;
};

/* ------------------------------- page ------------------------------- */
export default function AdminScreens() {
  const { token, role, roles: userRoles, user, loading, isAuthenticated } = useAuth() || {};

  if (loading) return null;

  const rolesList = useMemo(() => {
    const arr = Array.isArray(userRoles) && userRoles.length ? userRoles : role ? [role] : [];
    return arr.map(canonRole).filter(Boolean);
  }, [role, userRoles]);

  const isSomeAdmin = rolesList.some((r) =>
    /^(SUPER_ADMIN|ADMIN|THEATRE_ADMIN)$/.test(r || "")
  );

  if (!token && !isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (!isSomeAdmin) return <Navigate to="/" replace />;

  const isTheatreAdmin = rolesList.includes("THEATRE_ADMIN");

  const jwtTheatreId =
    user?.theatreId || user?.theaterId || user?.theatre?.id || user?.theater?.id || "";

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

  useEffect(() => {
    if (isTheatreAdmin && jwtTheatreId && !selectedTheater) {
      setSelectedTheater(jwtTheatreId);
    }
  }, [isTheatreAdmin, jwtTheatreId, selectedTheater]);

  // ✅ Use canonical list endpoint: /admin/theaters
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/admin/theaters?ts=${Date.now()}`);
        const list = Array.isArray(data) ? data : (data?.theaters || data?.data || []);
        setTheaters(Array.isArray(list) ? list : []);
        setMsg("");
      } catch (err) {
        setMsgType("error");
        setMsg("Failed to load theaters.");
        setTheaters([]);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTheatreAdmin]);

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
      setLoadingScreens(true);
      setMsg("");
      try {
        const list = await fetchScreensForTheater(selectedTheater);
        setScreens(list);
        setSelectedScreen(NEW);
        setScreenName("");
        setRows("");
        setCols("");
      } catch {
        setMsgType("error");
        setMsg("Could not load screens for this theater.");
      } finally {
        setLoadingScreens(false);
      }
    })();
  }, [selectedTheater]);

  useEffect(() => {
    if (selectedScreen === NEW) {
      setScreenName("");
      setRows("");
      setCols("");
      return;
    }
    const s = screens.find((x) => x && x._id === selectedScreen);
    if (s) {
      const n = normalizeScreen(s);
      setScreenName(S(n.name));
      setRows(S(n.rows));
      setCols(S(n.cols));
    }
  }, [selectedScreen, screens]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTheater || !screenName || !rows || !cols) {
      setMsgType("error");
      setMsg("Please fill in all fields.");
      return;
    }

    const r = Number(rows), c = Number(cols);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r <= 0 || c <= 0) {
      setMsgType("error");
      setMsg("Rows and columns must be positive integers.");
      return;
    }

    setLoadingAction(true);
    setMsg("");
    const body = { name: screenName.trim(), rows: r, columns: c, cols: c };

    try {
      if (selectedScreen === NEW) {
        const resp = await api.post(`/admin/theaters/${selectedTheater}/screens`, body);
        const created = resp?.data?.data || resp?.data;
        if (created?._id) setScreens((p) => [normalizeScreen(created), ...p]);
        const list = await fetchScreensForTheater(selectedTheater);
        setScreens(list);
        setSelectedScreen(NEW);
        setScreenName("");
        setRows("");
        setCols("");
        setMsgType("success");
        setMsg("Screen created successfully!");
      } else {
        const resp = await updateScreenApi(selectedTheater, selectedScreen, body);
        const updatedDoc = resp?.data?.data || resp?.data || null;
        if (updatedDoc && updatedDoc._id) {
          const normalized = normalizeScreen({
            ...updatedDoc,
            cols: updatedDoc.cols ?? updatedDoc.columns,
          });
          setScreens((prev) =>
            prev.map((s) => (s._id === normalized._id ? { ...s, ...normalized } : s))
          );
          setScreenName(S(normalized.name));
          setRows(S(normalized.rows));
          setCols(S(normalized.cols));
        } else {
          const list = await fetchScreensForTheater(selectedTheater);
          setScreens(list);
        }
        setMsgType("success");
        setMsg("Screen updated successfully!");
      }
    } catch (err) {
      setMsgType("error");
      setMsg("Failed to save screen.");
    } finally {
      setLoadingAction(false);
    }
  }

  // ✅ Delete via canonical admin route
  async function deleteTheater(id) {
    if (!confirm("Delete this theater and its screens?")) return;
    try {
      await api.delete(`/admin/theaters/${id}`);
      setTheaters((prev) => prev.filter((t) => t._id !== id));
      if (selectedTheater === id) {
        setSelectedTheater("");
        setScreens([]);
        setSelectedScreen(NEW);
        setScreenName("");
        setRows("");
        setCols("");
      }
      setMsgType("info");
      setMsg("Theater deleted.");
    } catch {
      setMsgType("error");
      setMsg("Failed to delete theater.");
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <Building2 className="h-6 w-6 text-[#0654BA]" /> Manage Screens
              </h1>
              <p className="text-sm text-slate-600 mt-1">Add or update screens under each theater.</p>
            </div>
            <SecondaryBtn onClick={() => {
              (async () => {
                try {
                  const { data } = await api.get(`/admin/theaters?ts=${Date.now()}`);
                  const list = Array.isArray(data) ? data : (data?.theaters || data?.data || []);
                  setTheaters(Array.isArray(list) ? list : []);
                } catch {}
                if (selectedTheater) {
                  setLoadingScreens(true);
                  try {
                    const list = await fetchScreensForTheater(selectedTheater);
                    setScreens(list);
                  } finally {
                    setLoadingScreens(false);
                  }
                }
              })();
            }} className="text-sm">
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
          <h2 className="text-lg font-extrabold tracking-tight pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#0654BA]" /> Theater & Screen
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Field
                as="select"
                label="Select Theater"
                value={selectedTheater}
                onChange={(e) => setSelectedTheater(e.target.value)}
                disabled={isTheatreAdmin && !!jwtTheatreId}
              >
                <option value="">-- Choose a theater --</option>
                {(Array.isArray(theaters) ? theaters : []).map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} — {t.city}
                  </option>
                ))}
              </Field>
              {loadingScreens && selectedTheater && (
                <div className="text-xs text-slate-600 mt-1">Loading screens…</div>
              )}
            </div>

            {selectedTheater && (
              <div>
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
                        {s.name} ({n.rows ?? "?"}×{n.cols ?? "?"})
                      </option>
                    );
                  })}
                </Field>
              </div>
            )}

            <Field
              label="Screen Name"
              type="text"
              placeholder="e.g. Screen 1"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                type="number"
                min="1"
                placeholder="Rows"
                icon={Rows3}
                value={rows}
                onChange={(e) => setRows(e.target.value)}
                required
              />
              <Field
                type="number"
                min="1"
                placeholder="Columns"
                icon={Columns3}
                value={cols}
                onChange={(e) => setCols(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <PrimaryBtn disabled={loadingAction} type="submit">
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
                  setSelectedTheater(isTheatreAdmin ? (jwtTheatreId || "") : "");
                  setSelectedScreen(NEW);
                  setScreenName("");
                  setRows("");
                  setCols("");
                  setMsg("");
                }}
              >
                Clear
              </SecondaryBtn>
            </div>
          </form>
        </Card>

        {/* Theaters list */}
        <Card className="p-5">
          <h2 className="text-xl font-extrabold tracking-tight pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#0654BA]" /> Available Theaters
          </h2>

        {(!theaters || theaters.length === 0) ? (
            <p className="text-sm text-slate-600">No theaters found.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {theaters.map((t) => (
                <li key={t._id}>
                  <Card className="p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900">{t.name}</div>
                        <div className="text-sm text-slate-600">
                          {t.city} — {t.address || "No address"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryBtn
                          onClick={() => {
                            setSelectedTheater(t._id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-3 py-1 text-sm"
                        >
                          Use
                        </PrimaryBtn>
                        <SecondaryBtn
                          onClick={() => deleteTheater(t._id)}
                          className="px-3 py-1 text-sm"
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
                                className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-slate-50"
                              >
                                {s.name} — {n.rows ?? "?"}×{n.cols ?? "?"}
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
