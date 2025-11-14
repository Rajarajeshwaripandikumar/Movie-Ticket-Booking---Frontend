// src/pages/AdminScreens.jsx — Diagnostic-ready Manage Screens page
// Paste this file over src/pages/AdminScreens.jsx

import { useEffect, useMemo, useState } from "react";
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
 * Try to load screens with endpoint fallbacks.
 * Includes compatibility aliases used by your backend.
 */
async function fetchScreensForTheater(theaterId) {
  const candidates = [
    `/admin/theaters/${theaterId}/screens`,
    `/admin/theatres/${theaterId}/screens`,
    `/theaters/${theaterId}/screens`,
    `/theatres/${theaterId}/screens`,
    // alias endpoints (some frontends expect these)
    `/screens/by-theatre/${theaterId}`,
    `/api/screens/by-theatre/${theaterId}`,
  ];
  let lastErr = null;
  for (const path of candidates) {
    try {
      const res = await api.get(path, { params: { _ts: Date.now() } });
      const arr = extractScreenArray(res?.data);
      console.debug(`[AdminScreens] tried ${path} -> status=${res.status} items=${Array.isArray(arr) ? arr.length : "no-array"}`);
      if (Array.isArray(arr)) return arr.map(normalizeScreen);
    } catch (err) {
      lastErr = err;
      const st = err?.response?.status ?? "NO_STATUS";
      console.warn(`[AdminScreens] ${path} failed:`, st, err?.response?.data ?? err.message ?? err);
    }
  }
  throw lastErr || new Error("Failed to fetch screens");
}

/* Canonical role mapper (simple) */
const canonRole = (r = "") => {
  let v = String(r).toUpperCase().replace("ROLE_", "").trim();
  const map = { SUPERADMIN: "SUPER_ADMIN", THEATER_ADMIN: "THEATRE_ADMIN" };
  return map[v] || v;
};

/* ------------------------------- page ------------------------------- */
export default function AdminScreens() {
  const auth = useAuth() || {};

  // IMPORTANT: prefer adminToken when present
  const token = auth.adminToken || auth.token || "";
  // Use the AuthContext initialized flag
  const loading = auth.initialized === false;
  const isLoggedIn = !!(auth.isLoggedIn || token);

  // roles may be in auth.roles (array) or auth.role
  const rawRoles = auth.roles || auth.user?.roles || (auth.role ? [auth.role] : []);
  const roles = useMemo(() => (Array.isArray(rawRoles) ? rawRoles.map(canonRole) : []), [rawRoles]);
  const isAdminLike = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(r));

  // debug
  // eslint-disable-next-line no-console
  console.debug("[AdminScreens] auth summary:", {
    tokenPresent: !!token,
    tokenExcerpt: token ? (token.slice ? token.slice(0, 8) + "..." : "(token)") : null,
    roles,
    initialized: auth.initialized,
  });

  if (loading) return null;
  if (!token || !isLoggedIn) return <Navigate to="/admin/login" replace />;
  if (!isAdminLike) return <Navigate to="/" replace />;

  const isTheatreAdmin = roles.includes("THEATRE_ADMIN");
  const theatreIdFromJWT = auth.user?.theatreId || auth.user?.theatre?.id || auth.user?.theaterId || "";

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

  /* Load all theaters — with endpoint fallbacks (debugging enabled) */
  useEffect(() => {
    (async () => {
      try {
        const candidates = [
          "/admin/theaters",
          "/admin/theatres",
          "/api/admin/theaters",
          "/theaters",
          "/theatres",
          "/theaters/mine",
          "/theatres/mine",
        ];
        let list = [];
        let lastErr = null;
        for (const p of candidates) {
          try {
            const res = await api.get(p, { params: { _ts: Date.now() } });
            const arr = extractTheaterArray(res?.data);
            console.debug(`[AdminScreens] tried ${p} -> status=${res.status} preview=${JSON.stringify(res?.data).slice(0,200)}`);
            if (Array.isArray(arr) && arr.length > 0) {
              list = arr;
              break;
            }
          } catch (err) {
            lastErr = err;
            console.warn(`[AdminScreens] endpoint ${p} failed:`, err?.response?.status ?? "NO_STATUS", err?.response?.data ?? err.message ?? err);
            if (err?.response?.status === 401 || err?.response?.status === 403) {
              setMsg("Auth problem while loading theaters; ensure admin token is present.");
              setMsgType("error");
              break;
            }
          }
        }
        setTheaters(Array.isArray(list) ? list : []);
        if ((!Array.isArray(list) || list.length === 0) && lastErr) {
          console.debug("[AdminScreens] no theaters found; last error:", lastErr?.response?.data ?? lastErr?.message ?? lastErr);
        }
      } catch (e) {
        setMsgType("error");
        setMsg("Failed to load theaters.");
        console.error("[AdminScreens] load theaters error:", e);
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
        setMsg("");
        const list = await fetchScreensForTheater(selectedTheater);
        setScreens(list);
      } catch (err) {
        setMsg("Could not load screens.");
        setMsgType("error");
        console.debug("[AdminScreens] fetchScreens error:", err?.response?.data ?? err?.message ?? err);
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
        // try admin path first then public
        const candidates = [
          `/admin/theaters/${selectedTheater}/screens`,
          `/theaters/${selectedTheater}/screens`,
        ];
        let ok = false;
        for (const p of candidates) {
          try {
            await api.post(p, body);
            ok = true;
            break;
          } catch (e) {
            console.debug("[AdminScreens] create candidate failed:", p, e?.response?.status ?? e.message ?? e);
          }
        }
        if (!ok) throw new Error("Create screen failed");
      } else {
        const candidates = [
          `/admin/theaters/${selectedTheater}/screens/${selectedScreen}`,
          `/theaters/${selectedTheater}/screens/${selectedScreen}`,
        ];
        let ok = false;
        for (const p of candidates) {
          try {
            await api.patch(p, body);
            ok = true;
            break;
          } catch (e) {
            console.debug("[AdminScreens] update candidate failed:", p, e?.response?.status ?? e.message ?? e);
          }
        }
        if (!ok) throw new Error("Update screen failed");
      }

      const updated = await fetchScreensForTheater(selectedTheater);
      setScreens(updated);

      setMsg(selectedScreen === NEW ? "Screen created!" : "Screen updated!");
      setMsgType("success");
      setSelectedScreen(NEW);
      setScreenName("");
      setRows("");
      setCols("");
    } catch (err) {
      setMsg("Save failed.");
      setMsgType("error");
      console.debug("[AdminScreens] save error:", err?.response?.data ?? err?.message ?? err);
    } finally {
      setLoadingAction(false);
    }
  }

  /* Delete theatre */
  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      const candidates = [
        `/admin/theaters/${id}`,
        `/theaters/${id}`,
      ];
      let ok = false;
      for (const p of candidates) {
        try {
          await api.delete(p);
          ok = true;
          break;
        } catch (e) {
          console.debug("[AdminScreens] delete candidate failed:", p, e?.response?.status ?? e?.message ?? e);
        }
      }
      if (!ok) throw new Error("Delete failed on all paths");

      setTheaters((prev) => prev.filter((t) => t._id !== id && t.id !== id));
      if (selectedTheater === id) {
        setSelectedTheater("");
        setScreens([]);
      }
    } catch (err) {
      setMsg("Failed to delete theater.");
      setMsgType("error");
      console.debug("[AdminScreens] delete error:", err?.response?.data ?? err?.message ?? err);
    }
  }

  /* --------------------------- Diagnostics & refresh helpers --------------------------- */

  // Diagnostics: print local auth sources and do a raw fetch to admin endpoint
  async function runDiagnostics() {
    try {
      console.group("[AdminScreens] DIAGNOSTICS");
      console.debug("AuthContext:", auth);
      console.debug("getAuthFromStorage():", getAuthFromStorage());
      console.debug("axios defaults Authorization:", (api.defaults && api.defaults.headers && api.defaults.headers.common && api.defaults.headers.common.Authorization) || "none");

      // raw fetch to inspect response body/status (bypasses axios interceptors)
      const base = "https://movie-ticket-booking-backend-o1m2.onrender.com";
      const url = `${base}/api/admin/theaters?_ts=${Date.now()}`;
      try {
        const raw = await fetch(url, { credentials: "include", mode: "cors" });
        const txt = await raw.text();
        console.debug("raw fetch", url, "status", raw.status, "bodyPreview:", txt.slice(0, 500));
      } catch (e) {
        console.warn("raw fetch failed:", e?.message ?? e);
      }
      console.groupEnd();
    } catch (e) {
      console.error("runDiagnostics failed:", e);
    }
  }

  // Refresh theaters (same fallback logic used at mount)
  async function refreshTheaters() {
    try {
      const candidates = [
        "/admin/theaters",
        "/admin/theatres",
        "/api/admin/theaters",
        "/theaters",
        "/theatres",
      ];
      for (const p of candidates) {
        try {
          const { data, status } = await api.get(p, { params: { _ts: Date.now() } });
          console.debug("[AdminScreens][refresh] tried", p, "status", status);
          const arr = extractTheaterArray(data);
          if (Array.isArray(arr) && arr.length) {
            setTheaters(arr);
            return;
          }
        } catch (e) {
          console.debug("[AdminScreens][refresh] failed", p, e?.response?.status ?? e?.message ?? e);
        }
      }
      // if none found, keep existing theaters and show a message
      setMsg("Could not refresh theaters from backend.");
      setMsgType("error");
    } catch (e) {
      console.error("refreshTheaters failed:", e);
      setMsg("Refresh failed.");
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

            <div className="flex items-center gap-2">
              <SecondaryBtn onClick={runDiagnostics}>Diagnostics</SecondaryBtn>
              <SecondaryBtn onClick={refreshTheaters}>
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
                        >
                          Use
                        </PrimaryBtn>

                        <SecondaryBtn
                          className="px-3 py-1 text-sm"
                          onClick={() => deleteTheater(t._id || t.id)}
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
