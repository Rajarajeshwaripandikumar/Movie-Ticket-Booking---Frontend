// src/pages/AdminShowtimes.jsx
import React, { useEffect, useMemo, useState } from "react";
import api, { API_DEBUG } from "../api/api";
import { useAuth } from "../context/AuthContext";
import {
  CalendarClock as CalendarClockLucide,
  Film,
  Building2,
  LayoutGrid,
  CircleDollarSign,
  RefreshCcw,
  PlusCircle,
  PencilLine,
  Eye,
  X,
} from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`admin-card bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", icon: Icon, className = "", children, ...props }) {
  const C = as;
  return (
    <div>
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

/* ----------------------------- helpers ----------------------------- */
const NEW = "__new__";
const S = (v) => (v === undefined || v === null ? "" : String(v));

/* Try multiple candidate endpoints and return the first array/object found */
async function tryFetchCandidates(candidates = []) {
  let lastErr = null;
  for (const rawEp of candidates) {
    if (!rawEp) continue;
    const ep = String(rawEp).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
    try {
      const resData = await api.getFresh(ep, { params: { _ts: Date.now() } }); // returns res.data
      const payload = resData;
      // Array response
      if (Array.isArray(payload)) {
        if (API_DEBUG) console.debug("[tryFetchCandidates] array ->", ep, payload.length);
        return payload;
      }
      // object response with data or other array keys
      if (payload && typeof payload === "object") {
        if (Array.isArray(payload.data)) {
          if (API_DEBUG) console.debug("[tryFetchCandidates] payload.data ->", ep, payload.data.length);
          return payload.data;
        }
        for (const key of Object.keys(payload)) {
          if (Array.isArray(payload[key])) {
            if (API_DEBUG) console.debug("[tryFetchCandidates] payload.%s -> %s (%d)", key, ep, payload[key].length);
            return payload[key];
          }
        }
        // single resource -> array
        if (payload._id || payload.id) {
          if (API_DEBUG) console.debug("[tryFetchCandidates] single object ->", ep);
          return [payload];
        }
      }
      if (API_DEBUG) console.debug("[tryFetchCandidates] no array found at", ep, payload);
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      if (API_DEBUG || status >= 400) {
        console.warn(`[${status ?? "ERR"}] GET ${rawEp}`, e?.response?.data || e?.message || e);
      }
    }
  }
  if (lastErr && API_DEBUG) console.warn("All candidates failed:", candidates, lastErr?.message || lastErr);
  return [];
}

/* build seat labels for hint */
function toRowLabel(n) {
  let label = "";
  let x = n;
  while (x > 0) {
    x -= 1;
    label = String.fromCharCode(65 + (x % 26)) + label;
    x = Math.floor(x / 26);
  }
  return label;
}
function buildSeatHint(rows, cols) {
  if (!rows || !cols) return "";
  return `${toRowLabel(1)}1 — ${toRowLabel(rows)}${cols} (${rows}×${cols})`;
}

/* seat-grid renderer helper (converts seats array to map) */
function seatsToMap(seats = []) {
  const m = new Map();
  let maxRow = 0;
  let maxCol = 0;
  for (const s of seats || []) {
    const r = Number(s.row), c = Number(s.col);
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
    m.set(`${r}:${c}`, s);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  return { map: m, maxRow, maxCol };
}

/* convert various server date formats into a value suitable for input[type=datetime-local] */
function toLocalDatetimeInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/* --------------------------- AdminShowtimes --------------------------- */
export default function AdminShowtimes() {
  const { token } = useAuth() || {}; // ensure auth client adds admin token
  const [movies, setMovies] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [screens, setScreens] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [movieId, setMovieId] = useState("");
  const [theaterId, setTheaterId] = useState("");
  const [screenId, setScreenId] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("");
  const [basePrice, setBasePrice] = useState(200);

  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState(null);

  const [showtimeId, setShowtimeId] = useState(NEW);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  // seat preview modal state
  const [seatPreviewOpen, setSeatPreviewOpen] = useState(false);
  const [seatPreviewData, setSeatPreviewData] = useState({ seats: [], rows: 0, cols: 0, title: "" });

  /* Load movies + theaters on auth change */
  useEffect(() => {
    if (!token) {
      setMovies([]); setTheaters([]); setShowtimes([]); setScreens([]);
      return;
    }
    loadMovies();
    loadTheaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* --------------------- loading helpers --------------------- */
  async function loadMovies() {
    try {
      const candidates = ["/movies", "/movies/list", "/movies/admin/list"];
      const list = await tryFetchCandidates(candidates);
      setMovies(list || []);
      if (list && list.length && !movieId) setMovieId(list[0]._id || list[0].id || "");
    } catch (err) {
      if (API_DEBUG) console.error("loadMovies error", err);
      showMsg("Failed to load movies.", "error");
    }
  }

  async function loadTheaters() {
    try {
      const candidates = ["/theaters/mine", "/theaters", "/theatres", "/theaters/mine", "/theatres/me"];
      const list = await tryFetchCandidates(candidates);
      setTheaters(list || []);
      if (list && list.length) {
        const first = list[0];
        const firstId = first._id || first.id || "";
        if (!theaterId) {
          setTheaterId(firstId);
          setCity(first.city || "");
          if (firstId) {
            await loadScreensForTheater(firstId);
            await loadShowtimesMyTheatre(firstId);
          }
        }
      } else {
        showMsg("No theatres linked to this account.", "error");
      }
    } catch (err) {
      if (API_DEBUG) console.error("loadTheaters error", err);
      showMsg("Failed to load theaters.", "error");
    }
  }

  async function loadScreensForTheater(id) {
    setScreens([]); setScreenId(""); setRows(null); setCols(null);
    if (!id) return;
    try {
      const candidates = [`/screens/by-theatre/${id}`, `/theaters/${id}/screens`, `/screens?theaterId=${id}`];
      const list = await tryFetchCandidates(candidates);
      setScreens(list || []);
      if (list && list.length) {
        const first = list[0];
        const firstId = first._id || first.id || "";
        if (!screenId) {
          setScreenId(firstId);
          deriveRowsColsFromScreen(first);
        }
      }
    } catch (err) {
      if (API_DEBUG) console.error("loadScreensForTheater error", err);
      showMsg("Failed to load screens.", "error");
    }
  }

  async function loadShowtimesMyTheatre(thId = theaterId) {
    try {
      const candidates = ["/showtimes/my-theatre", thId ? `/showtimes?theaterId=${thId}` : null, "/showtimes"].filter(Boolean);
      const list = await tryFetchCandidates(candidates);
      setShowtimes(list || []);
      if (list && list.length && showtimeId === NEW) {
        setShowtimeId(list[0]._id || list[0].id || NEW);
        const st = list[0].startTime || list[0].startAt || list[0].date || null;
        if (st) setStartTime(toLocalDatetimeInputValue(st));
      }
    } catch (err) {
      if (API_DEBUG) console.error("loadShowtimesMyTheatre error", err);
      showMsg("Failed to load showtimes.", "error");
    }
  }

  function deriveRowsColsFromScreen(scr) {
    if (!scr) return;
    const r = scr.rows ?? scr.seatRows ?? scr.numRows ?? null;
    const c = scr.cols ?? scr.columns ?? scr.seatCols ?? scr.numCols ?? null;
    setRows(r); setCols(c);
  }

  function showMsg(text = "", type = "info", ms = 5000) {
    setMsg(text); setMsgType(type);
    if (ms) setTimeout(() => { setMsg(""); setMsgType("info"); }, ms);
  }

  /* --------------------- create / update / delete --------------------- */
  async function createShowtime(e) {
    e.preventDefault();
    if (!movieId || !theaterId || !screenId || !city || !startTime) {
      showMsg("Movie, theater, screen, city, and start time are required.", "error");
      return;
    }
    setLoading(true);
    try {
      // Convert local datetime-local value to ISO
      const iso = new Date(startTime).toISOString();
      const payload = {
        movie: movieId,
        theater: theaterId,
        screen: screenId,
        city,
        startTime: iso,
        basePrice: Number(basePrice),
        price: Number(basePrice),
        amount: Number(basePrice),
        rows: rows ?? undefined,
        cols: cols ?? undefined,
      };

      const createCandidates = ["/showtimes", "/showtimes/create", "/api/showtimes"];
      let created = false;
      let lastErr = null;
      for (const epRaw of createCandidates) {
        try {
          const ep = String(epRaw).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
          if (API_DEBUG) console.debug("[createShowtime] trying", ep, payload);
          await api.post(ep, payload);
          created = true;
          break;
        } catch (err) {
          lastErr = err;
          const status = err?.response?.status;
          if (API_DEBUG || status >= 400) console.warn(`[${status ?? "ERR"}] POST ${epRaw}`, err?.response?.data || err?.message || err);
        }
      }
      if (!created) {
        if (API_DEBUG) console.error("createShowtime failed (all endpoints)", lastErr);
        throw new Error(lastErr?.response?.data?.message || lastErr?.message || "Create endpoint not found");
      }

      showMsg("Showtime created successfully!", "success");
      setStartTime("");
      await loadShowtimesMyTheatre(theaterId);
    } catch (err) {
      if (API_DEBUG) console.error("createShowtime error", err);
      showMsg(err?.response?.data?.message || err?.message || "Failed to create showtime", "error");
    } finally {
      setLoading(false);
    }
  }

  async function patchShowtime(e) {
    e.preventDefault();
    if (!showtimeId || showtimeId === NEW) return showMsg("Select a showtime to update.", "error");
    setLoading(true);
    try {
      const iso = new Date(startTime).toISOString();
      const body = { startTime: iso, startAt: iso };

      const candidates = [`/showtimes/${showtimeId}`, `/api/showtimes/${showtimeId}`];
      let patched = false;
      let lastErr = null;
      for (const epRaw of candidates) {
        try {
          const ep = String(epRaw).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
          if (API_DEBUG) console.debug("[patchShowtime] trying", ep, body);
          await api.patch(ep, body);
          patched = true;
          break;
        } catch (e) {
          lastErr = e;
          const status = e?.response?.status;
          if (API_DEBUG || status >= 400) console.warn(`[${status ?? "ERR"}] PATCH ${epRaw}`, e?.response?.data || e?.message || e);
        }
      }
      if (!patched) {
        if (API_DEBUG) console.error("patchShowtime failed (all endpoints)", lastErr);
        throw new Error(lastErr?.response?.data?.message || lastErr?.message || "Update endpoint not found");
      }

      showMsg("Showtime updated successfully!", "success");
      await loadShowtimesMyTheatre(theaterId);
    } catch (err) {
      if (API_DEBUG) console.error("patchShowtime error", err);
      showMsg(err?.response?.data?.message || err?.message || "Failed to update showtime", "error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteShowtime(id) {
    if (!id) return;
    if (!window.confirm("Delete this showtime?")) return;
    setLoading(true);
    try {
      const candidates = [`/showtimes/${id}`, `/api/showtimes/${id}`];
      let deleted = false;
      let lastErr = null;
      for (const epRaw of candidates) {
        try {
          const ep = String(epRaw).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
          if (API_DEBUG) console.debug("[deleteShowtime] trying", ep);
          await api.delete(ep);
          deleted = true;
          break;
        } catch (e) {
          lastErr = e;
          const status = e?.response?.status;
          if (API_DEBUG || status >= 400) console.warn(`[${status ?? "ERR"}] DELETE ${epRaw}`, e?.response?.data || e?.message || e);
        }
      }
      if (!deleted) {
        if (API_DEBUG) console.error("deleteShowtime failed (all endpoints)", lastErr);
        throw new Error(lastErr?.response?.data?.message || lastErr?.message || "Delete endpoint not found");
      }

      showMsg("Showtime deleted", "success");
      await loadShowtimesMyTheatre(theaterId);
    } catch (err) {
      if (API_DEBUG) console.error("delete showtime error", err);
      showMsg(err?.response?.data?.message || err?.message || "Delete failed", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectShowtime(id) {
    setShowtimeId(id || NEW);
    const st = showtimes.find((s) => s._id === id || s.id === id);
    if (st) {
      setStartTime(toLocalDatetimeInputValue(st.startTime ?? st.startAt ?? st.date ?? st.datetime));
      setBasePrice(st.basePrice ?? st.price ?? st.amount ?? 200);
      setCity(st.theater?.city ?? st.city ?? "");
      if (st.screen) setScreenId(st.screen._id ?? st.screen);
      if (st.theater) setTheaterId(st.theater._id ?? st.theater);
      if (st.movie) setMovieId(st.movie._id ?? st.movie);
    }
  }

  function handleTheaterChange(id) {
    setTheaterId(id);
    const th = theaters.find((t) => String(t._id || t.id) === String(id));
    setCity(th?.city || "");
    loadScreensForTheater(id);
    loadShowtimesMyTheatre(id);
  }

  function handleScreenChange(id) {
    setScreenId(id);
    const scr = screens.find((s) => String(s._id || s.id) === String(id));
    deriveRowsColsFromScreen(scr);
  }

  /* ------------------ Seat preview modal ------------------ */
  async function openSeatPreviewForScreen(screenIdArg) {
    if (!screenIdArg) {
      showMsg("No screen selected", "error");
      return;
    }
    setSeatPreviewData({ seats: [], rows: 0, cols: 0, title: "Screen seats" });
    setSeatPreviewOpen(true);
    try {
      // try admin seats endpoint then fallback to get screen
      const candidates = [`/screens/${screenIdArg}/seats`, `/admin/screens/${screenIdArg}/seats`, `/screens/${screenIdArg}`];
      let payload = null;
      for (const epRaw of candidates) {
        try {
          const ep = String(epRaw).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
          if (API_DEBUG) console.debug("[openSeatPreviewForScreen] trying", ep);
          const res = await api.get(ep, { params: { _ts: Date.now() } });
          payload = res?.data;
          break;
        } catch (e) {
          if (API_DEBUG) console.debug("[openSeatPreviewForScreen] failed", epRaw, e?.response?.status ?? e?.message ?? e);
        }
      }
      if (!payload) throw new Error("No seat data");
      // If payload is raw array
      if (Array.isArray(payload)) {
        setSeatPreviewData({ seats: payload.map((lab) => {
          // attempt parse label "A1" -> {row,col}
          const m = String(lab).match(/^([A-Za-z]+)(\d+)$/);
          if (m) {
            const rowLabel = m[1], col = Number(m[2]);
            // convert rowLabel to number
            let row = 0;
            for (let i = 0; i < rowLabel.length; i++) row = row * 26 + (rowLabel.charCodeAt(i) - 64);
            return { row, col, status: "AVAILABLE" };
          }
          return null;
        }).filter(Boolean), rows: (payload.length && payload.length > 0) ? undefined : 0, cols: undefined, title: "Screen seats" });
        return;
      }
      // If payload is object { ok:true, data: [...], rows, cols }
      if (payload?.data && Array.isArray(payload.data)) {
        setSeatPreviewData({ seats: payload.data, rows: payload.rows || undefined, cols: payload.cols || undefined, title: "Screen seats" });
        return;
      }
      // If payload is a screen object with rows/cols
      if (payload?.rows || payload?.cols) {
        const r = Number(payload.rows) || 0;
        const c = Number(payload.cols) || 0;
        // build seat array
        const seats = [];
        for (let rr = 1; rr <= r; rr++) {
          for (let cc = 1; cc <= c; cc++) seats.push({ row: rr, col: cc, status: "AVAILABLE" });
        }
        setSeatPreviewData({ seats, rows: r, cols: c, title: `${payload.name || "Screen"} seats` });
        return;
      }
      showMsg("Could not parse seats for screen", "error");
    } catch (err) {
      if (API_DEBUG) console.error("openSeatPreviewForScreen error", err);
      showMsg("Failed to load seat data", "error");
    }
  }

  async function openSeatPreviewForShowtime(showtimeIdArg) {
    if (!showtimeIdArg) return showMsg("No showtime selected", "error");
    setSeatPreviewData({ seats: [], rows: 0, cols: 0, title: "Showtime seats" });
    setSeatPreviewOpen(true);
    try {
      const candidates = [`/showtimes/${showtimeIdArg}`, `/api/showtimes/${showtimeIdArg}`];
      let payload = null;
      for (const epRaw of candidates) {
        try {
          const ep = String(epRaw).replace(/^\/api\/?/, "/").replace(/^\/+/, "/");
          if (API_DEBUG) console.debug("[openSeatPreviewForShowtime] trying", ep);
          const res = await api.get(ep, { params: { _ts: Date.now() } });
          payload = res?.data;
          break;
        } catch (e) {
          if (API_DEBUG) console.debug("[openSeatPreviewForShowtime] failed", epRaw, e?.response?.status ?? e?.message ?? e);
        }
      }
      if (!payload) throw new Error("No showtime data");
      const seats = Array.isArray(payload.seats) ? payload.seats : (payload.data?.seats ?? payload.seats ?? []);
      const rowsCount = payload.rows ?? (Array.isArray(seats) ? Math.max(...seats.map(s => Number(s.row || 0)), 0) : 0);
      const colsCount = payload.cols ?? (Array.isArray(seats) ? Math.max(...seats.map(s => Number(s.col || 0)), 0) : 0);
      setSeatPreviewData({ seats: seats || [], rows: rowsCount, cols: colsCount, title: payload.movie?.title ? `${payload.movie.title} — seats` : "Showtime seats" });
    } catch (err) {
      if (API_DEBUG) console.error("openSeatPreviewForShowtime error", err);
      showMsg("Failed to load showtime seats", "error");
    }
  }

  /* -------------------- small UI guards -------------------- */
  const canCreate = movieId && theaterId && screenId && city && startTime && !loading;
  const canUpdate = showtimeId && showtimeId !== NEW && startTime && !loading;

  /* -------------------- initial helpers for UI -------------------- */
  // small effect to keep city in sync when theater changes
  useEffect(() => {
    const t = theaters.find((x) => String(x._id || x.id) === String(theaterId));
    if (t) setCity(t.city || "");
  }, [theaterId, theaters]);

  /* -------------------- render seat grid component -------------------- */
  function SeatGrid({ seats, rows: rCount, cols: cCount }) {
    const { map, maxRow, maxCol } = seatsToMap(seats);
    const rowsToRender = rCount || maxRow || 0;
    const colsToRender = cCount || maxCol || 0;
    if (!rowsToRender || !colsToRender) return <div className="text-sm text-slate-600">No seat layout available.</div>;

    return (
      <div className="overflow-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${colsToRender}, minmax(36px, 1fr))` }}>
          {Array.from({ length: rowsToRender }).map((_, rIdx) => {
            const rowNum = rIdx + 1;
            return (
              <React.Fragment key={`row-${rowNum}`}>
                {Array.from({ length: colsToRender }).map((_, cIdx) => {
                  const colNum = cIdx + 1;
                  const key = `${rowNum}:${colNum}`;
                  const s = map.get(key);
                  const status = (s && s.status) || "AVAILABLE";
                  const label = `${toRowLabel(rowNum)}${colNum}`;
                  const classes =
                    status === "BOOKED"
                      ? "bg-rose-100 border-rose-300 text-rose-800"
                      : status === "LOCKED"
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800";
                  return (
                    <div
                      key={key}
                      title={`${label} — ${status}`}
                      className={`text-xs border rounded-md p-2 text-center ${classes} flex items-center justify-center`}
                      style={{ minHeight: 36 }}
                    >
                      <div>
                        <div className="font-semibold">{label}</div>
                        <div className="text-[10px]">{status.replace("_", " ")}</div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  /* --------------------------- UI --------------------------- */
  return (
    <main className="admin-showtimes-root min-h-screen bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      {/* Local CSS override to force vertical stacking & full width of cards. */}
      <style>{`
        .admin-showtimes-root .stack { display: flex !important; flex-direction: column !important; gap: 1.5rem !important; }
        .admin-showtimes-root .admin-card { display: block !important; width: 100% !important; }
        .seat-modal-backdrop { position: fixed; inset: 0; background: rgba(2,6,23,0.45); display:flex; align-items:center; justify-content:center; z-index:60; }
      `}</style>

      <div className="w-full max-w-6xl mx-auto stack">
        {/* Header */}
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <CalendarClockLucide className="h-6 w-6" /> Manage Showtimes
            </h1>
            <p className="text-sm text-slate-600 mt-1">Create, update, and organize theater schedules.</p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryBtn onClick={() => loadShowtimesMyTheatre()}>
              <RefreshCcw className="h-4 w-4" /> Refresh
            </SecondaryBtn>
            <SecondaryBtn onClick={() => { loadMovies(); loadTheaters(); }}>
              Reload Data
            </SecondaryBtn>
          </div>
        </Card>

        {/* Inline toast/message */}
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

        {/* Create form */}
        <Card className="p-5">
          <h2 className="text-lg font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <PlusCircle className="h-5 w-5" /> Create Showtime
          </h2>

          <form onSubmit={createShowtime} className="space-y-3">
            <Field as="select" value={movieId} onChange={(e) => setMovieId(e.target.value)} icon={Film}>
              <option value="">-- Select Movie --</option>
              {Array.isArray(movies) &&
                movies.map((m) => (
                  <option key={m._id || m.id} value={m._id || m.id}>
                    {m.title || m.name}
                  </option>
                ))}
            </Field>

            <Field as="select" value={theaterId} onChange={(e) => handleTheaterChange(e.target.value)} icon={Building2}>
              <option value="">-- Select Theater --</option>
              {Array.isArray(theaters) &&
                theaters.map((t) => (
                  <option key={t._id || t.id} value={t._id || t.id}>
                    {t.name} — {t.city || ""}
                  </option>
                ))}
            </Field>

            <div className="flex gap-3">
              <div className="flex-1">
                <Field as="select" value={screenId} onChange={(e) => handleScreenChange(e.target.value)} icon={LayoutGrid} disabled={!theaterId}>
                  <option value="">-- Select Screen --</option>
                  {Array.isArray(screens) &&
                    screens.map((s) => {
                      const r = s.rows ?? s.seatRows ?? s.numRows ?? "";
                      const c = s.cols ?? s.columns ?? s.seatCols ?? s.numCols ?? "";
                      return (
                        <option key={s._id || s.id} value={s._id || s.id}>
                          {s.name} {r && c ? `(${r}x${c})` : ""}
                        </option>
                      );
                    })}
                </Field>
              </div>
              <div className="w-40">
                <SecondaryBtn type="button" onClick={() => openSeatPreviewForScreen(screenId)} disabled={!screenId}>
                  <Eye className="h-4 w-4" /> Preview Seats
                </SecondaryBtn>
              </div>
            </div>

            <Field value={city} readOnly placeholder="City auto-selected from theater" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                icon={CalendarClockLucide}
              />
              <Field
                type="number"
                placeholder="Base Price"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                icon={CircleDollarSign}
                min="0"
                step="1"
              />
            </div>

            <div className="text-sm text-slate-600">Seat grid: {buildSeatHint(rows, cols) || "unknown — preview screen to see grid"}</div>

            <div className="flex items-center justify-end">
              <PrimaryBtn disabled={!canCreate}>{loading ? "Creating…" : "Create Showtime"}</PrimaryBtn>
            </div>
          </form>
        </Card>

        {/* Update form */}
        <Card className="p-5">
          <h2 className="text-lg font-extrabold pb-2 mb-4 border-b border-slate-200 flex items-center gap-2">
            <PencilLine className="h-5 w-5" /> Update Showtime
          </h2>

          <form onSubmit={patchShowtime} className="space-y-3">
            <Field as="select" value={showtimeId} onChange={(e) => handleSelectShowtime(e.target.value)} icon={CalendarClockLucide}>
              <option value={NEW}>-- Select Showtime --</option>
              {Array.isArray(showtimes) &&
                showtimes.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {(s.movie?.title || s.movie?.name || (s.movie && String(s.movie)) || "Movie")} — {s.city || ""} —{" "}
                    {s.startTime ? new Date(s.startTime).toLocaleString() : s.startAt ? new Date(s.startAt).toLocaleString() : "—"} — ₹
                    {s.basePrice ?? s.price ?? s.amount ?? ""}
                  </option>
                ))}
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} icon={CalendarClockLucide} />
              <div className="flex items-center gap-2">
                <SecondaryBtn type="button" onClick={() => openSeatPreviewForShowtime(showtimeId)} disabled={!showtimeId || showtimeId === NEW}>
                  <Eye className="h-4 w-4" /> View Showtime Seats
                </SecondaryBtn>
                <div className="ml-auto">
                  <PrimaryBtn disabled={!canUpdate}>{loading ? "Updating…" : "Update Showtime"}</PrimaryBtn>
                </div>
              </div>
            </div>
          </form>
        </Card>

        {/* Existing showtimes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">Existing Showtimes</h3>
            <div className="text-sm text-slate-500">{showtimes.length} items</div>
          </div>

          {showtimes.length === 0 ? (
            <div className="text-slate-600">No showtimes found</div>
          ) : (
            <div className="space-y-3">
              {showtimes.map((s) => {
                const movieTitle = (s.movie && (s.movie.title || s.movie.name)) || (typeof s.movie === "string" ? s.movie : "Unknown movie");
                const theatreName = (s.theater && (s.theater.name || s.theater.title)) || s.city || "";
                const start = s.startTime || s.startAt || s.date || s.datetime || "";
                return (
                  <div key={s._id || s.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                    <div>
                      <div className="font-semibold">{movieTitle}</div>
                      <div className="text-sm text-slate-600">
                        {theatreName} • {s.screen?.name || s.screen || "screen"} • {start ? new Date(start).toLocaleString() : "—"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <SecondaryBtn
                        onClick={() => {
                          handleSelectShowtime(s._id || s.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </SecondaryBtn>

                      <SecondaryBtn onClick={() => openSeatPreviewForShowtime(s._id || s.id)}>
                        <Eye className="h-4 w-4" /> Seats
                      </SecondaryBtn>

                      <SecondaryBtn
                        onClick={() => {
                          deleteShowtime(s._id || s.id);
                        }}
                        className="text-rose-700 border-rose-200"
                      >
                        Delete
                      </SecondaryBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Seat Preview Modal */}
      {seatPreviewOpen && (
        <div className="seat-modal-backdrop" role="dialog" aria-modal="true" aria-label="Seat preview">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-[95%] p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">{seatPreviewData.title || "Seats"}</div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600 mr-2">{seatPreviewData.rows}×{seatPreviewData.cols}</div>
                <button
                  onClick={() => setSeatPreviewOpen(false)}
                  className="inline-flex items-center justify-center p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close seat preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div style={{ maxHeight: "65vh", overflow: "auto" }}>
              <SeatGrid seats={seatPreviewData.seats} rows={seatPreviewData.rows} cols={seatPreviewData.cols} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-xs px-2 py-1 rounded-lg border bg-emerald-50 text-emerald-700">AVAILABLE</div>
              <div className="text-xs px-2 py-1 rounded-lg border bg-yellow-50 text-yellow-700">LOCKED</div>
              <div className="text-xs px-2 py-1 rounded-lg border bg-rose-50 text-rose-700">BOOKED</div>
              <div className="ml-auto">
                <SecondaryBtn onClick={() => setSeatPreviewOpen(false)}>Close</SecondaryBtn>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* --------------------------- small extra components --------------------------- */
function CalendarClockIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 8h18M21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3v4M8 3v4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
