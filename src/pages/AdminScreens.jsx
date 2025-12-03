// src/pages/AdminScreens.jsx — Manage Screens (clean, hardened, no diagnostics or view-seats)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { getAuthFromStorage } from "../api/api";
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
  CreditCard,
  AlertTriangle,
} from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, label, className = "", children, ...props }) {
  const C = as;
  return (
    <div>
      {label && <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
        <C
          {...props}
          className={`w-full outline-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 ${className}`}
        >
          {children}
        </C>
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

/* -------------------- robust extractors -------------------- */
function extractScreenArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload?.ok && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.screens)) return payload.screens;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function extractTheaterArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (payload?.ok && Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.theaters)) return payload.theaters;
  if (Array.isArray(payload.theatres)) return payload.theatres;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

/* ----------------------------- networking ----------------------------- */
/**
 * Load screens for a theater using the canonical endpoint.
 * NOTE: api.defaults.baseURL already contains the /api prefix.
 */
async function fetchScreensForTheater(theaterId, signal) {
  const path = `/screens/by-theatre/${theaterId}`;
  const res = await api.get(path, { params: { _ts: Date.now() }, signal });
  const arr = extractScreenArray(res?.data);
  return arr.map(normalizeScreen);
}

/* ------------------------------- page ------------------------------- */
export default function AdminScreens() {
  const auth = useAuth() || {};

  // prefer adminToken when present
  const token = auth.adminToken || auth.token || "";
  const loadingAuth = auth.initialized === false;
  const isLoggedIn = !!(auth.isLoggedIn || token);

  const rawRoles = auth.roles || auth.user?.roles || (auth.role ? [auth.role] : []);
  const roles = useMemo(() => (Array.isArray(rawRoles) ? rawRoles : []), [rawRoles]);
  const isAdminLike = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(r));

  // debug – helps verify which role you are
  console.log("[AdminScreens] auth user", auth?.user, "roles", roles);

  // hydrate axios quickly if context not ready
  useEffect(() => {
    try {
      const stored = getAuthFromStorage?.() || {};
      const storedToken = stored?.token || localStorage.getItem("adminToken") || localStorage.getItem("token");
      if (storedToken && api && typeof api.setAuthToken === "function") {
        api.setAuthToken(storedToken);
        console.debug("[AdminScreens] hydrated api token from storage");
      }
    } catch {
      // ignore
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingAuth) return null;
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

  const mountedRef = useRef(true);
  const refreshAbortRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        refreshAbortRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  // auto-select theater for THEATRE_ADMIN if JWT has theatre id
  useEffect(() => {
    if (isTheatreAdmin && theatreIdFromJWT && !selectedTheater) {
      setSelectedTheater(theatreIdFromJWT);
    }
  }, [isTheatreAdmin, theatreIdFromJWT, selectedTheater]);

  /* ---------------------------
   * Refresh theaters (canonical)
   * --------------------------- */
  const refreshTheaters = useCallback(async () => {
    try {
      setMsg("");
      setMsgType("info");

      // cancel previous refresh if any
      try {
        refreshAbortRef.current?.abort();
      } catch {
        // ignore
      }
      const ac = new AbortController();
      refreshAbortRef.current = ac;

      const path = "/admin/theaters";

      const stored = getAuthFromStorage?.() || {};
      const authToken =
        token ||
        stored?.token ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        "";

      const resp = await api.get(path, {
        params: { _ts: Date.now() },
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        signal: ac.signal,
      });

      const arr = extractTheaterArray(resp?.data);
      if (!mountedRef.current) return;

      if (Array.isArray(arr)) {
        setTheaters(arr);
        setMsg("");
        setMsgType("info");
      } else {
        setMsg("Could not refresh theaters from backend.");
        setMsgType("error");
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (e?.name === "CanceledError" || e?.name === "AbortError") return;

      console.error("[AdminScreens] refreshTheaters failed:", e);
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        setMsg("Auth problem while loading theaters; ensure admin token is present.");
      } else {
        setMsg("Refresh failed.");
      }
      setMsgType("error");
    }
  }, [token]);

  useEffect(() => {
    refreshTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const ac = new AbortController();
    (async () => {
      try {
        setLoadingScreens(true);
        setMsg("");
        const list = await fetchScreensForTheater(selectedTheater, ac.signal);
        if (!mountedRef.current) return;
        setScreens(list);
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        setMsg("Could not load screens.");
        setMsgType("error");
        console.debug("[AdminScreens] fetchScreens error:", err?.response?.data ?? err?.message ?? err);
      } finally {
        if (mountedRef.current) setLoadingScreens(false);
      }
    })();

    return () => ac.abort();
  }, [selectedTheater]);

  /* When selecting screen from dropdown */
  useEffect(() => {
    if (selectedScreen === NEW) {
      setScreenName("");
      setRows("");
      setCols("");
      return;
    }

    const s = screens.find((x) => x && (x._id === selectedScreen || x.id === selectedScreen));
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

    const r = Number(rows);
    const c = Number(cols);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r <= 0 || c <= 0) {
      setMsg("Rows/Columns must be positive.");
      setMsgType("error");
      return;
    }

    setLoadingAction(true);
    const body = { name: screenName.trim(), rows: r, columns: c, cols: c };

    try {
      const stored = getAuthFromStorage?.() || {};
      const authToken =
        token ||
        stored?.token ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        "";

      if (selectedScreen === NEW) {
        // CREATE
        const path = `/admin/theaters/${selectedTheater}/screens`;
        await api.post(path, body, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
      } else {
        // UPDATE
        const path = `/admin/theaters/${selectedTheater}/screens/${selectedScreen}`;
        await api.patch(path, body, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
      }

      // Refresh both theaters & screens so UI reflects new data
      await refreshTheaters();
      const updated = await fetchScreensForTheater(selectedTheater);
      if (mountedRef.current) setScreens(updated);

      if (!mountedRef.current) return;
      setMsg(selectedScreen === NEW ? "Screen created!" : "Screen updated!");
      setMsgType("success");
      setSelectedScreen(NEW);
      setScreenName("");
      setRows("");
      setCols("");
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setMsg("Auth error creating/updating screen; check admin role on backend.");
      } else {
        setMsg("Save failed.");
      }
      setMsgType("error");
      console.debug("[AdminScreens] save error:", err?.response?.data ?? err?.message ?? err);
    } finally {
      if (mountedRef.current) setLoadingAction(false);
    }
  }

  /* Delete theater */
  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    setLoadingAction(true);
    try {
      const stored = getAuthFromStorage?.() || {};
      const authToken =
        token ||
        stored?.token ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        "";

      const path = `/admin/theaters/${id}`;
      await api.delete(path, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      if (mountedRef.current) {
        setTheaters((prev) => prev.filter((t) => t._id !== id && t.id !== id));
        if (selectedTheater === id) {
          setSelectedTheater("");
          setScreens([]);
        }
        setMsg("Theater deleted");
        setMsgType("success");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setMsg("Auth error deleting theater; check admin role on backend.");
      } else {
        setMsg("Failed to delete theater.");
      }
      setMsgType("error");
      console.debug("[AdminScreens] delete error:", err?.response?.data ?? err?.message ?? err);
    } finally {
      if (mountedRef.current) setLoadingAction(false);
    }
  }

  /* Delete a screen (scoped) */
  async function deleteScreen(screenId) {
    if (!confirm("Delete this screen?")) return;
    if (!selectedTheater) {
      setMsg("Select a theater first.");
      setMsgType("error");
      return;
    }
    setLoadingAction(true);
    try {
      const stored = getAuthFromStorage?.() || {};
      const authToken =
        token ||
        stored?.token ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        "";

      const path = `/admin/theaters/${selectedTheater}/screens/${screenId}`;
      await api.delete(path, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      const updated = await fetchScreensForTheater(selectedTheater);
      if (mountedRef.current) {
        setScreens(updated);
        setMsg("Screen deleted");
        setMsgType("success");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setMsg("Auth error deleting screen; check admin role on backend.");
      } else {
        setMsg("Failed to delete screen.");
      }
      setMsgType("error");
      console.debug("[AdminScreens] delete screen error:", err?.response?.data ?? err?.message ?? err);
    } finally {
      if (mountedRef.current) setLoadingAction(false);
    }
  }

  const theaterSelectDisabled = isTheatreAdmin && !!theatreIdFromJWT;

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

            <div className="flex items-center gap-2">
              <SecondaryBtn onClick={refreshTheaters} disabled={loadingAction}>
                <RefreshCcw className="h-4 w-4" /> Refresh
              </SecondaryBtn>
            </div>
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
            <div className="flex items-center gap-2">
              {msgType === "error" && <AlertTriangle className="h-4 w-4" />}
              {msgType === "success" && <CreditCard className="h-4 w-4" />}
              <span>{msg}</span>
            </div>
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
              disabled={theaterSelectDisabled || loadingAction}
            >
              <option value="">-- Choose a theater --</option>
              {theaters.map((t) => (
                <option key={t._id || t.id} value={t._id || t.id}>
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
                    <option key={s._id || s.id} value={s._id || s.id}>
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
              <PrimaryBtn type="submit" disabled={loadingAction || !selectedTheater}>
                {loadingAction ? (
                  "Saving…"
                ) : selectedScreen === NEW ? (
                  <>
                    <PlusCircle className="h-4 w-4" /> Create Screen
                  </>
                ) : (
                  "Update Screen"
                )}
              </PrimaryBtn>

              <div className="flex gap-2">
                <SecondaryBtn
                  type="button"
                  disabled={loadingAction}
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
                <li key={t._id || t.id}>
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
                            setSelectedTheater(t._id || t.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          disabled={loadingAction}
                        >
                          Use
                        </PrimaryBtn>

                        <SecondaryBtn
                          className="px-3 py-1 text-sm"
                          onClick={() => deleteTheater(t._id || t.id)}
                          disabled={loadingAction}
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
                                key={s._id || s.id}
                                className="text-xs px-2 py-1 rounded-lg border bg-slate-50 flex items-center gap-2"
                              >
                                <span>
                                  {s.name} — {n.rows}×{n.cols}
                                </span>
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-white"
                                  onClick={() => {
                                    setSelectedTheater(t._id || t.id);
                                    setSelectedScreen(s._id || s.id);
                                  }}
                                  disabled={loadingAction}
                                >
                                  <span className="text-xs">Select</span>
                                </button>
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-white ml-1"
                                  onClick={() => deleteScreen(s._id || s.id)}
                                  disabled={loadingAction}
                                  title="Delete screen"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
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
