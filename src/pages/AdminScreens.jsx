/* Diagnostic-ready AdminScreens.jsx
   Paste over src/pages/AdminScreens.jsx (keeps your UI; adds diagnostic logs)
*/

import { useEffect, useMemo, useState } from "react";
import api, { canonRole as apiCanonRole, getAuthFromStorage } from "../api/api";
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

/* ... (Walmart primitive components Card, Field, PrimaryBtn, SecondaryBtn unchanged) ... */
/* I'll omit the primitive component code here for brevity in this response.
   Use the same Card/Field/PrimaryBtn/SecondaryBtn definitions you already have. */

const NEW = "__new__";
const S = (v) => (v === undefined || v === null ? "" : String(v));

const normalizeScreen = (s = {}) => {
  const rows = Number(s.rows ?? s.row ?? s.r);
  const cols = Number(s.cols ?? s.columns ?? s.col ?? s.c);
  return { ...s, rows: Number.isFinite(rows) ? rows : 0, cols: Number.isFinite(cols) ? cols : 0 };
};

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

/* fetchScreensForTheater — identical fallback list but with explicit console.debug */
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

/* canonRole helper */
const canonRole = (r = "") => {
  let v = String(r).toUpperCase().replace("ROLE_", "").trim();
  const map = { SUPERADMIN: "SUPER_ADMIN", THEATER_ADMIN: "THEATRE_ADMIN" };
  return map[v] || v;
};

export default function AdminScreens() {
  const auth = useAuth() || {};

  const token = auth.adminToken || auth.token || "";
  const loading = auth.initialized === false;
  const isLoggedIn = !!(auth.isLoggedIn || token);

  const rawRoles = auth.roles || auth.user?.roles || (auth.role ? [auth.role] : []);
  const roles = useMemo(() => (Array.isArray(rawRoles) ? rawRoles.map(canonRole) : []), [rawRoles]);
  const isAdminLike = roles.some((r) => ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(r));

  console.debug("[AdminScreens] auth summary:", { tokenPresent: !!token, tokenExcerpt: token ? token.slice(0, 8) + "..." : null, roles, initialized: auth.initialized });

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

  useEffect(() => {
    if (isTheatreAdmin && theatreIdFromJWT && !selectedTheater) setSelectedTheater(theatreIdFromJWT);
  }, [isTheatreAdmin, theatreIdFromJWT, selectedTheater]);

  /* Load theaters with explicit debug */
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

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

  useEffect(() => {
    if (selectedScreen === NEW) {
      setScreenName(""); setRows(""); setCols(""); return;
    }
    const s = screens.find((x) => x && (x._id === selectedScreen || x.id === selectedScreen));
    if (s) { setScreenName(S(s.name)); setRows(S(s.rows)); setCols(S(s.cols)); }
  }, [selectedScreen, screens]);

  /* DIAGNOSTIC: prints token sources from api.getAuthFromStorage and axios headers */
  async function runDiagnostics() {
    try {
      console.group("[AdminScreens] DIAGNOSTICS");
      console.debug("local auth context:", auth);
      console.debug("getAuthFromStorage():", getAuthFromStorage());
      console.debug("axios defaults Authorization:", (api.defaults && api.defaults.headers && api.defaults.headers.common && api.defaults.headers.common.Authorization) || "none");
      // quick raw fetch to admin endpoint to inspect status/body (bypasses axios interceptors)
      const base = window.location.origin.includes("netlify") ? "https://movie-ticket-booking-backend-o1m2.onrender.com" : "";
      const url = `${base}/api/admin/theaters?_ts=${Date.now()}`;
      try {
        const raw = await fetch(url, { credentials: "include", mode: "cors" });
        const txt = await raw.text();
        console.debug("raw fetch", url, "status", raw.status, txt.slice(0,200));
      } catch (e) {
        console.warn("raw fetch failed:", e.message || e);
      }
      console.groupEnd();
    } catch (e) {
      console.error("runDiagnostics failed:", e);
    }
  }

  /* The rest of page (submit/delete) remains same as your existing code — omitted here for brevity.
     Keep the same handleSubmit, deleteTheater, UI rendering. Make sure to include a small
     Diagnostics button in the header which calls runDiagnostics() so you can click it and copy console output. */

  return (
    <main className="min-h-screen ...">
      {/* paste your existing UI here unchanged, but in the header add: */}
      <div className="flex items-center gap-2">
        <SecondaryBtn onClick={runDiagnostics}>Diagnostics</SecondaryBtn>
        <SecondaryBtn onClick={/* your existing refresh function */ undefined}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </SecondaryBtn>
      </div>

      {/* rest of UI */}
    </main>
  );
}
