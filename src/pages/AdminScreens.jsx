// src/pages/AdminScreens.jsx  — Debuggable version (drop-in)
// Adds a debug panel to test endpoints and inspect responses/headers/token

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

/* small UI primitives (kept same look) */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);
function Field({ as = "input", icon: Icon, label, className = "", ...props }) {
  const C = as;
  return (
    <div>
      {label && <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {Icon && <Icon className="h-4 w-4 text-slate-500" />}
        <C {...props} className={`w-full outline-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 ${className}`} />
      </div>
    </div>
  );
}
function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button className={`inline-flex items-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] ${className}`} {...props}>
      {children}
    </button>
  );
}
function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white ${className}`} {...props}>
      {children}
    </button>
  );
}

/* helpers */
const NEW = "__new__";
const S = (v) => (v === undefined || v === null ? "" : String(v));
const normalizeScreen = (s = {}) => {
  const rows = Number(s.rows ?? s.row ?? s.r);
  const cols = Number(s.cols ?? s.columns ?? s.col ?? s.c);
  return { ...s, rows: Number.isFinite(rows) ? rows : 0, cols: Number.isFinite(cols) ? cols : 0 };
};

/* extractors (same as before) */
function extractScreenArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.screens)) return payload.screens;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}
function extractTheaterArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.theaters)) return payload.theaters;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.theatres)) return payload.theatres;
  return [];
}

/* network helpers (same fallbacks) */
async function fetchScreensForTheater(theaterId) {
  const candidates = [
    `/admin/theaters/${theaterId}/screens`,
    `/admin/theatres/${theaterId}/screens`,
    `/theaters/${theaterId}/screens`,
    `/theatres/${theaterId}/screens`,
    `/screens/by-theatre/${theaterId}`,
    `/api/screens/by-theatre/${theaterId}`,
  ];
  let lastErr = null;
  for (const path of candidates) {
    try {
      const res = await api.get(path, { params: { _ts: Date.now() } });
      const arr = extractScreenArray(res?.data);
      if (Array.isArray(arr)) return arr.map(normalizeScreen);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Failed to fetch screens");
}

/* role mapper */
const canonRole = (r = "") => {
  let v = String(r).toUpperCase().replace("ROLE_", "").trim();
  const map = { SUPERADMIN: "SUPER_ADMIN", THEATER_ADMIN: "THEATRE_ADMIN" };
  return map[v] || v;
};

/* ------------------------------- component ------------------------------- */
export default function AdminScreens() {
  const auth = useAuth() || {};
  const token = auth.adminToken || auth.token || "";
  const loading = auth.initialized === false;
  const isLoggedIn = !!(auth.isLoggedIn || token);

  const rawRoles = auth.roles || auth.user?.roles || (auth.role ? [auth.role] : []);
  const roles = useMemo(() => (Array.isArray(rawRoles) ? rawRoles.map(canonRole) : []), [rawRoles]);
  const isAdminLike = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(r));

  // debug
  // eslint-disable-next-line no-console
  console.debug("[AdminScreens] auth:", { tokenPresent: !!token, roles, initialized: auth.initialized });

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

  // debug state
  const [dbgLines, setDbgLines] = useState([]);
  const [lastErr, setLastErr] = useState(null);

  const pushDbg = (obj) => {
    setDbgLines((s) => [String(new Date().toISOString()) + " " + (typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)), ...s].slice(0, 200));
  };

  useEffect(() => {
    if (isTheatreAdmin && theatreIdFromJWT && !selectedTheater) setSelectedTheater(theatreIdFromJWT);
  }, [isTheatreAdmin, theatreIdFromJWT, selectedTheater]);

  /* load theaters (minimal attempt) */
  useEffect(() => {
    (async () => {
      try {
        const candidates = ["/admin/theaters", "/theaters", "/api/admin/theaters", "/theaters/mine"];
        let list = [];
        for (const p of candidates) {
          try {
            pushDbg(`trying ${p}`);
            const res = await api.get(p, { params: { _ts: Date.now() } });
            pushDbg({ url: p, status: res.status, dataPreview: JSON.stringify(res.data).slice(0, 800) });
            const arr = extractTheaterArray(res?.data);
            if (Array.isArray(arr) && arr.length >= 0) {
              list = arr;
              break;
            }
          } catch (e) {
            pushDbg({ url: p, err: e?.response?.status || e.message || "network" });
            setLastErr(e);
          }
        }
        setTheaters(Array.isArray(list) ? list : []);
      } catch (e) {
        pushDbg("unexpected load theaters error: " + (e?.message || e));
        setLastErr(e);
      }
    })();
  }, [theatreIdFromJWT]);

  /* load screens for selected theatre */
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
        pushDbg(`fetching screens for ${selectedTheater}`);
        const list = await fetchScreensForTheater(selectedTheater);
        setScreens(list);
        pushDbg(`screens count=${list.length}`);
      } catch (e) {
        pushDbg("fetchScreens error: " + (e?.message || JSON.stringify(e?.response?.data || e)));
        setLastErr(e);
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
    const s = screens.find((x) => x && (x._id === selectedScreen || x.id === selectedScreen));
    if (s) {
      setScreenName(S(s.name));
      setRows(S(s.rows));
      setCols(S(s.cols));
    }
  }, [selectedScreen, screens]);

  /* Quick debug functions (manual tests) */
  async function debugCall(path) {
    try {
      pushDbg(`CALL ${path}`);
      const start = Date.now();
      const res = await api.get(path, { params: { _ts: Date.now() } });
      const took = Date.now() - start;
      pushDbg({ path, status: res.status, timeMs: took, headers: res.headers, dataPreview: JSON.stringify(res.data).slice(0, 1500) });
      setLastErr(null);
      return res;
    } catch (e) {
      pushDbg({ path, error: e?.response?.status || e.message || "network", details: e?.response?.data || null });
      setLastErr(e);
      throw e;
    }
  }

  async function debugAll() {
    setDbgLines([]);
    try {
      // show token from storage + axios
      const fromStorage = getAuthFromStorage();
      pushDbg({ fromStorage });
      pushDbg({ axiosAuthHeader: api.defaults?.headers?.common?.Authorization || null, sameOrigin: typeof window !== "undefined" && window.location.origin === (new URL(api.defaults.baseURL || window.location.href)).origin });
    } catch (e) {}
    try { await debugCall("/admin/theaters"); } catch(_) {}
    try { await debugCall("/theaters"); } catch(_) {}
    try { await debugCall("/theaters/mine"); } catch(_) {}
    try { if (theaters[0]) await debugCall(`/screens/by-theatre/${theaters[0]._id || theaters[0].id}`); } catch(_) {}
    try { await debugCall("/api/admin/theaters"); } catch(_) {}
  }

  /* submit / create / delete handlers remain same as before (omitted here for brevity) */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTheater || !screenName || !rows || !cols) { setMsg("Please fill in all fields."); setMsgType("error"); return; }
    const r = Number(rows), c = Number(cols);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r <= 0 || c <= 0) { setMsg("Rows/Columns must be positive."); setMsgType("error"); return; }
    setLoadingAction(true);
    const body = { name: screenName.trim(), rows: r, columns: c, cols: c };
    try {
      if (selectedScreen === NEW) {
        const candidates = [`/admin/theaters/${selectedTheater}/screens`, `/theaters/${selectedTheater}/screens`];
        let ok = false;
        for (const p of candidates) {
          try { await api.post(p, body); ok = true; break; } catch (e) { pushDbg({ createErr: p, status: e?.response?.status }); }
        }
        if (!ok) throw new Error("Create screen failed");
      } else {
        const candidates = [`/admin/theaters/${selectedTheater}/screens/${selectedScreen}`, `/theaters/${selectedTheater}/screens/${selectedScreen}`];
        let ok = false;
        for (const p of candidates) {
          try { await api.patch(p, body); ok = true; break; } catch (e) { pushDbg({ updateErr: p, status: e?.response?.status }); }
        }
        if (!ok) throw new Error("Update screen failed");
      }
      const updated = await fetchScreensForTheater(selectedTheater);
      setScreens(updated);
      setMsg("Saved.");
      setMsgType("success");
      setSelectedScreen(NEW); setScreenName(""); setRows(""); setCols("");
    } catch (err) {
      setMsg("Save failed.");
      setMsgType("error");
      setLastErr(err);
      pushDbg({ saveErr: err?.response?.status || err.message });
    } finally { setLoadingAction(false); }
  }

  async function deleteTheater(id) {
    if (!confirm("Delete this theater?")) return;
    try {
      const candidates = [`/admin/theaters/${id}`, `/theaters/${id}`];
      let ok = false;
      for (const p of candidates) {
        try { await api.delete(p); ok = true; break; } catch (e) { pushDbg({ delErr: p, status: e?.response?.status }); }
      }
      if (!ok) throw new Error("Delete failed on all paths");
      setTheaters((prev) => prev.filter((t) => t._id !== id && t.id !== id));
      if (selectedTheater === id) { setSelectedTheater(""); setScreens([]); }
    } catch (err) {
      setMsg("Failed to delete theater."); setMsgType("error"); setLastErr(err); pushDbg({ deleteErr: err?.response?.status || err.message });
    }
  }

  /* --------------------------- UI --------------------------- */
  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <Card className="p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2"><Building2 className="h-7 w-7 text-[#0654BA]" /> Manage Screens</h1>
            <p className="text-sm text-slate-600 mt-1">Add or update screens for each theater.</p>
          </div>
          <div className="flex flex-col gap-2">
            <SecondaryBtn onClick={debugAll}><RefreshCcw className="h-4 w-4" /> Debug: test endpoints</SecondaryBtn>
            <div className="text-xs text-slate-500">Token preview: <code style={{fontSize:12}}>{S(getAuthFromStorage().token).slice(0,60)}</code></div>
          </div>
        </Card>

        {msg && <Card className={`p-3 font-semibold ${msgType==="error"?"bg-rose-50 border-rose-200 text-rose-700":"bg-emerald-50 border-emerald-200 text-emerald-700"}`}>{msg}</Card>}

        {/* Form (unchanged) */}
        <Card className="max-w-2xl mx-auto p-5">
          <h2 className="text-lg font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-[#0654BA]" /> Theater & Screen</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field as="select" label="Select Theater" value={selectedTheater} onChange={(e)=>setSelectedTheater(e.target.value)} disabled={isTheatreAdmin}>
              <option value="">-- Choose a theater --</option>
              {theaters.map((t)=> (<option key={t._id||t.id} value={t._id||t.id}>{t.name} — {t.city}</option>))}
            </Field>

            {loadingScreens && selectedTheater && <div className="text-xs text-slate-600 mt-1">Loading screens…</div>}

            {selectedTheater ? (
              <Field as="select" label="Select Screen" value={selectedScreen} onChange={(e)=>setSelectedScreen(e.target.value)}>
                <option value={NEW}>➕ Create New Screen</option>
                {screens.map((s)=> {
                  const n = normalizeScreen(s);
                  return (<option key={s._id||s.id} value={s._id||s.id}>{s.name} ({n.rows}×{n.cols})</option>);
                })}
              </Field>
            ) : null}

            <Field label="Screen Name" placeholder="e.g. Screen 1" value={screenName} onChange={(e)=>setScreenName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field type="number" min="1" placeholder="Rows" icon={Rows3} value={rows} onChange={(e)=>setRows(e.target.value)} />
              <Field type="number" min="1" placeholder="Columns" icon={Columns3} value={cols} onChange={(e)=>setCols(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <PrimaryBtn type="submit" disabled={loadingAction}>{loadingAction ? "Saving…" : selectedScreen===NEW ? <> <PlusCircle className="h-4 w-4" /> Create Screen</> : "Update Screen"}</PrimaryBtn>
              <SecondaryBtn type="button" onClick={()=>{setSelectedScreen(NEW); setScreenName(""); setRows(""); setCols("");}}>Clear</SecondaryBtn>
            </div>
          </form>
        </Card>

        {/* Theaters list */}
        <Card className="p-5">
          <h2 className="text-xl font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2"><Building2 className="h-5 w-5 text-[#0654BA]" /> Available Theaters</h2>

          {theaters.length===0 ? <p className="text-sm text-slate-600">No theaters found.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {theaters.map((t)=>(
                <li key={t._id||t.id}>
                  <Card className="p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-extrabold">{t.name}</div>
                        <div className="text-sm text-slate-600">{t.city} — {t.address || "No address"}</div>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryBtn className="px-3 py-1 text-sm" onClick={()=>{ setSelectedTheater(t._id||t.id); window.scrollTo({top:0, behavior:"smooth"});}}>Use</PrimaryBtn>
                        <SecondaryBtn className="px-3 py-1 text-sm" onClick={()=>deleteTheater(t._id||t.id)}><Trash2 className="h-4 w-4" /> Delete</SecondaryBtn>
                      </div>
                    </div>

                    {Array.isArray(t.screens) && t.screens.length>0 && (
                      <div className="mt-3">
                        <div className="text-sm font-semibold mb-1 flex items-center gap-1 text-slate-800"><LayoutGrid className="h-4 w-4" /> Screens</div>
                        <div className="flex flex-wrap gap-2">
                          {t.screens.map((s)=> { const n=normalizeScreen(s); return (<span key={s._id||s.id} className="text-xs px-2 py-1 rounded-lg border bg-slate-50">{s.name} — {n.rows}×{n.cols}</span>); })}
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Debug panel */}
        <Card className="p-4">
          <h3 className="font-bold mb-2">Debug panel</h3>
          <div className="flex gap-2 mb-3">
            <SecondaryBtn onClick={()=>debugCall("/admin/theaters")}>Test /admin/theaters</SecondaryBtn>
            <SecondaryBtn onClick={()=>debugCall("/theaters")}>Test /theaters</SecondaryBtn>
            <SecondaryBtn onClick={()=>debugCall("/api/admin/theaters")}>Test /api/admin/theaters</SecondaryBtn>
            <SecondaryBtn onClick={()=>debugCall("/theaters/mine")}>Test /theaters/mine</SecondaryBtn>
            <SecondaryBtn onClick={()=>debugCall("/notifications/mine")}>Test /notifications/mine</SecondaryBtn>
            <SecondaryBtn onClick={debugAll}>Run All</SecondaryBtn>
          </div>

          <div className="text-xs text-slate-700 mb-2">
            <div><strong>Token (storage):</strong> <code style={{fontSize:12}}>{S(getAuthFromStorage().token).slice(0,200)}</code></div>
            <div><strong>Axios Authorization header:</strong> <code style={{fontSize:12}}>{S(api.defaults?.headers?.common?.Authorization).slice(0,200)}</code></div>
            <div><strong>Last error status:</strong> {lastErr?.response?.status ?? lastErr?.status ?? "—"}</div>
            <div><strong>Last error body:</strong> <pre style={{whiteSpace:"pre-wrap", maxHeight:160, overflow:"auto"}}>{JSON.stringify(lastErr?.response?.data || lastErr?.message || null, null, 2)}</pre></div>
          </div>

          <div className="max-h-48 overflow-auto bg-slate-50 p-2 border rounded">
            {dbgLines.length===0 ? <div className="text-xs text-slate-500">No debug lines yet — click "Run All" or the test buttons.</div> :
              dbgLines.map((l,i)=>(<div key={i} className="text-[11px] font-mono break-words mb-1">{l}</div>))
            }
          </div>
        </Card>
      </div>
    </main>
  );
}
