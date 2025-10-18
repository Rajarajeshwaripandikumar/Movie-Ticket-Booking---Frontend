// frontend/src/pages/AdminAnalytics.jsx — Walmart Style (Blue, Rounded, Clean)
// Updated: adds SSE realtime (EventSource) + live status badge
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  ShoppingBag,
  Users,
  Gauge,
  BarChart3,
  Activity,
  Building2,
  Film,
  RefreshCcw,
  Bell,
  Filter,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

/* =============================================================================
   Admin Analytics wired to YOUR Express routes (Walmart UI)
   Routes mounted at /api/analytics:
     - GET /revenue/trends?days=N
     - GET /users/active?days=N
     - GET /movies/popular?days=N&limit=10
     - GET /occupancy?days=N
     - GET /bookings/summary?days=N
   SSE: GET /stream (API_BASE + "/stream") emits:
     - event: snapshot  -> full snapshot { revenueDaily, dauDaily, movies, occupancy, summary }
     - event: revenue   -> { dayISO, revenue, bookings } or { dayISO, revenueDelta, bookingsDelta }
     - event: dau       -> { dayISO, users } or { dayISO, usersDelta }
     - event: movies    -> array or single movie object
     - event: occupancy -> array or single occupancy object
     - event: summary   -> KPI deltas { revenueDelta, ordersDelta, revenue7dDelta, aov, dau }
   ========================================================================== */

function resolveApiBase() {
  const base =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080";
  return `${base.replace(/\/+$/, "")}/api/analytics`;
}
const API_BASE = resolveApiBase();

/* ----------------------------- Walmart tokens ----------------------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";
const SOFT = "#94A3B8";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Pill = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}
  >
    {children}
  </button>
);

const Primary = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-[${BLUE}] text-white hover:bg-[${BLUE_DARK}] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}
  >
    {children}
  </button>
);

/* ------------------------------ UI helpers ------------------------------ */
const ranges = [
  { id: "7d", label: "Last 7d", days: 7 },
  { id: "14d", label: "Last 14d", days: 14 },
  { id: "30d", label: "Last 30d", days: 30 },
  { id: "90d", label: "Last 90d", days: 90 },
];

function Segments({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`px-3 py-1.5 rounded-full text-sm transition ${
            value === r.id
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-800"
          }`}
          aria-pressed={value === r.id}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function formatCurrency(n) {
  const v = Number.isFinite(+n) ? +n : 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `₹${v.toLocaleString("en-IN")}`;
  }
}
const formatInt = (n) =>
  Number.isFinite(+n) ? Math.round(+n).toLocaleString("en-IN") : "0";

function Stat({ icon: Icon, label, value, delta }) {
  const DeltaIcon = delta == null ? null : delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta == null ? "" : delta >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
            <Icon className="h-5 w-5 text-slate-900" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-slate-600">{label}</p>
            <p className="text-xl font-extrabold text-slate-900">{value}</p>
          </div>
        </div>
        {DeltaIcon && (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${deltaColor}`}>
            <DeltaIcon className="h-3.5 w-3.5" />
            <span className="font-semibold">{Math.abs(delta)}%</span>
          </span>
        )}
      </div>
    </Card>
  );
}

const HeaderBar = ({ range, setRange, onRefresh, onExport, onToggleAlerts, onToggleFilters, liveStatus }) => (
  <div className="space-y-3">
    <div className="flex items-start justify-between gap-4">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Admin Analytics</h1>
      <div className="mt-1 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-slate-600">
          <span className={`h-2 w-2 rounded-full ${liveStatus === "connected" ? "bg-emerald-500" : liveStatus === "connecting" ? "bg-amber-400" : "bg-rose-400"}`} />
          <span className="font-medium">{liveStatus === "connected" ? "Live" : liveStatus === "connecting" ? "Connecting…" : "Disconnected"}</span>
        </span>
      </div>
    </div>

    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">Revenue, usage, and theater performance at a glance.</div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Pill onClick={onToggleAlerts}><Bell className="h-4 w-4" /> Alerts</Pill>
          <Pill onClick={onToggleFilters}><Filter className="h-4 w-4" /> Filter</Pill>
          <Primary onClick={onExport}><Download className="h-4 w-4" /> Export CSV</Primary>
          <Pill onClick={onRefresh}><RefreshCcw className="h-4 w-4" /> Refresh</Pill>
          <Segments value={range} onChange={setRange} />
        </div>
      </div>
    </Card>
  </div>
);

function ChartCard({ title, subtitle, children, right }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-600">{subtitle}</p>
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        </div>
        {right}
      </div>
      <div className="mt-4 h-64">{children}</div>
    </Card>
  );
}

function SimpleTable({ title, rows, columns }) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              {columns.map((c) => (
                <th key={c.key} className="py-2 font-semibold">{c.label}</th>
              ))}
            </tr>
          </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200">
              {columns.map((c) => (
                <td key={c.key} className="py-2">
                  {c.render ? c.render(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </Card>
  );
}

const EmptyMini = ({ label }) => (
  <div className="h-full w-full grid place-items-center text-center text-sm text-slate-600">
    <div>
      <Activity className="h-6 w-6 mx-auto mb-2 opacity-70" />
      <p>{label}</p>
    </div>
  </div>
);

/* ----------------------------- API helpers ---------------------------- */
const authHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params, signal) {
  const url = new URL(API_BASE + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    signal,
    credentials: "include",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.message || ""; } catch {}
    const base = `HTTP ${res.status} ${res.statusText}`;
    throw new Error(detail ? `${base} — ${detail}` : base);
  }
  return res.json();
}

/* ---------------------------- data transforms ---------------------------- */
const fmtDay = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d || "");
  return dt
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-");
};

// Keep both pretty label (for charts) and raw ISO day (for CSV)
const toRevenueDaily = (arr = []) =>
  arr.map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || "";
    return {
      day: fmtDay(iso || `D${i + 1}`),
      dayISO: iso,
      revenue: Number(d.totalRevenue ?? 0),
      bookings: Number(d.bookings ?? 0),
    };
  });

const toDauDaily = (arr = []) =>
  arr.map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || "";
    return {
      day: fmtDay(iso || `D${i + 1}`),
      dayISO: iso,
      users: Number(d.dau ?? 0),
    };
  });

const toMovies = (arr = []) =>
  arr.map((m) => ({
    title: m.movieName ?? m.title ?? "Unknown",
    revenue: Number(m.totalRevenue ?? m.revenue ?? 0),
    bookings: Number(m.totalBookings ?? m.bookings ?? 0),
    seatsBooked: Number(m.seatsBooked ?? 0),
  }));

const toTheaterOcc = (arr = []) =>
  arr.map((t) => ({
    name: t.theaterName ?? t.name ?? "Unknown",
    occupancy: Math.round(Number(t.occupancyRate ?? 0) * 100),
  }));

function buildSummary(summaryData = [], dauData = [], revenue7 = 0) {
  const totals = summaryData.reduce(
    (acc, d) => {
      acc.revenue += Number(d.revenue ?? 0);
      acc.orders += Number(d.confirmed ?? 0);
      return acc;
    },
    { revenue: 0, orders: 0 }
  );
  const aov = totals.orders ? Math.round(totals.revenue / totals.orders) : 0;
  const avgDau = dauData.length
    ? Math.round(dauData.reduce((s, d) => s + (Number(d.dau ?? 0)), 0) / dauData.length)
    : 0;

  return { revenue30d: totals.revenue, orders: totals.orders, aov, revenue7d: revenue7, dau: avgDau };
}

/* ----------------------------- Realtime hook ---------------------------- */
/**
 * useRealtime opens an EventSource to `url` and calls onMessage(payload, type)
 * - reconnects with backoff
 * - calls onMessage({__poll:true}, 'poll') during polling fallback
 */
function useRealtime({ url, onMessage, enabled = true, pollFallbackMs = 30000, setLiveStatus }) {
  const esRef = useRef(null);
  const backoffRef = useRef(1000);
  const closedRef = useRef(false);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    closedRef.current = false;
    setLiveStatus?.("connecting");

    const connect = () => {
      if (typeof window === "undefined") return;
      try {
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.onopen = () => {
          backoffRef.current = 1000;
          setLiveStatus?.("connected");
        };

        // generic 'message' events
        es.addEventListener("message", (ev) => {
          try { onMessage(JSON.parse(ev.data), "message"); } catch (e) {}
        });

        const types = ["snapshot", "revenue", "dau", "movies", "occupancy", "summary"];
        types.forEach((t) => {
          es.addEventListener(t, (ev) => {
            try { onMessage(JSON.parse(ev.data), t); } catch (e) {}
          });
        });

        es.onerror = () => {
          // signal connection problem; attempt reconnect with backoff
          setLiveStatus?.("connecting");
          try { es.close(); } catch (e) {}
          esRef.current = null;
          if (closedRef.current) return;
          setTimeout(() => {
            backoffRef.current = Math.min(Math.round(backoffRef.current * 1.8), 30000);
            connect();
          }, backoffRef.current);
        };
      } catch (err) {
        // EventSource unsupported or blocked — fallback to polling
        setLiveStatus?.("disconnected");
        schedulePoll();
      }
    };

    const schedulePoll = () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        onMessage({ __poll: true }, "poll");
      }, pollFallbackMs);
    };

    connect();

    return () => {
      closedRef.current = true;
      if (esRef.current) try { esRef.current.close(); } catch (e) {}
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [url, onMessage, enabled, pollFallbackMs, setLiveStatus]);
}

/* -------------------------------- View -------------------------------- */
export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({ revenue30d: 0, orders: 0, aov: 0, revenue7d: 0, dau: 0 });
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dauDaily, setDauDaily] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [theaterOcc, setTheaterOcc] = useState([]);

  const [movieLimit] = useState(10);
  const controllerRef = useRef(null);
  const daysOf = (id) => ranges.find((r) => r.id === id)?.days ?? 30;

  // live status: 'connected' | 'connecting' | 'disconnected'
  const [liveStatus, setLiveStatus] = useState("connecting");

  // stable loadData so useRealtime/polling can call it
  const loadData = useCallback(
    async (selectedRange) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError("");
      const days = daysOf(selectedRange);

      try {
        const [revTrends, dau, movies, occ, bookSum, bookSum7] = await Promise.all([
          getJSON("/revenue/trends", { days }, controller.signal),
          getJSON("/users/active", { days }, controller.signal),
          getJSON("/movies/popular", { days, limit: movieLimit }, controller.signal),
          getJSON("/occupancy", { days }, controller.signal),
          getJSON("/bookings/summary", { days }, controller.signal),
          getJSON("/bookings/summary", { days: 7 }, controller.signal),
        ]);

        const revenueDailyT = toRevenueDaily(revTrends);
        const dauDailyT = toDauDaily(dau);
        const moviesT = toMovies(movies);
        const occT = toTheaterOcc(occ);
        const revenue7 = (bookSum7 || []).reduce((s, d) => s + Number(d.revenue ?? 0), 0);
        const kpis = buildSummary(bookSum, dau, revenue7);

        setRevenueDaily(revenueDailyT);
        setDauDaily(dauDailyT);
        setTopMovies(moviesT);
        setTheaterOcc(occT);
        setSummary(kpis);
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error("Analytics load failed:", e);
        setError(e.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    },
    [movieLimit]
  );

  // initial load + reload on range change
  useEffect(() => {
    loadData(range);
    return () => controllerRef.current?.abort();
  }, [range, loadData]);

  /* ------------------ realtime message handler ------------------ */
  const handleRealtimeMessage = useCallback(
    (payload, type) => {
      // Poll fallback triggered: reload full snapshot
      if (type === "poll" || (payload && payload.__poll)) {
        loadData(range);
        return;
      }

      if (type === "snapshot") {
        const { revenueDaily: rev = [], dauDaily: d = [], movies = [], occupancy = [], summary: summ = null } = payload || {};
        if (rev) setRevenueDaily(toRevenueDaily(rev));
        if (d) setDauDaily(toDauDaily(d));
        if (movies) setTopMovies(toMovies(movies));
        if (occupancy) setTheaterOcc(toTheaterOcc(occupancy));
        if (summ) setSummary((prev) => ({ ...prev, ...summ }));
        return;
      }

      if (type === "revenue") {
        // payload may be full day or delta
        setRevenueDaily((prev) => {
          const arr = [...prev];
          const idx = arr.findIndex((d) => d.dayISO === payload.dayISO);
          if (payload.revenue != null) {
            const entry = { day: fmtDay(payload.dayISO), dayISO: payload.dayISO, revenue: Number(payload.revenue), bookings: Number(payload.bookings ?? 0) };
            if (idx >= 0) arr[idx] = entry;
            else arr.unshift(entry);
            return arr;
          }
          if (payload.revenueDelta != null) {
            if (idx >= 0) {
              arr[idx] = { ...arr[idx], revenue: Number(arr[idx].revenue || 0) + Number(payload.revenueDelta || 0), bookings: Number(arr[idx].bookings || 0) + Number(payload.bookingsDelta || 0) };
              return arr;
            } else {
              return [{ day: fmtDay(payload.dayISO), dayISO: payload.dayISO, revenue: Number(payload.revenueDelta || 0), bookings: Number(payload.bookingsDelta || 0) }, ...arr];
            }
          }
          return prev;
        });
        return;
      }

      if (type === "dau") {
        setDauDaily((prev) => {
          const arr = [...prev];
          const idx = arr.findIndex((d) => d.dayISO === payload.dayISO);
          if (payload.users != null) {
            const entry = { day: fmtDay(payload.dayISO), dayISO: payload.dayISO, users: Number(payload.users) };
            if (idx >= 0) arr[idx] = entry;
            else arr.unshift(entry);
            return arr;
          }
          if (payload.usersDelta != null) {
            if (idx >= 0) {
              arr[idx] = { ...arr[idx], users: Number(arr[idx].users || 0) + Number(payload.usersDelta || 0) };
              return arr;
            } else {
              return [{ day: fmtDay(payload.dayISO), dayISO: payload.dayISO, users: Number(payload.usersDelta || 0) }, ...arr];
            }
          }
          return prev;
        });
        return;
      }

      if (type === "movies") {
        if (Array.isArray(payload)) setTopMovies(toMovies(payload));
        else if (payload) {
          setTopMovies((prev) => {
            const copy = [...prev];
            const i = copy.findIndex((m) => m.title === (payload.movieName || payload.title));
            const updated = { title: payload.movieName || payload.title, revenue: Number(payload.totalRevenue ?? payload.revenue ?? 0), bookings: Number(payload.totalBookings ?? payload.bookings ?? 0), seatsBooked: Number(payload.seatsBooked ?? 0) };
            if (i >= 0) copy[i] = updated;
            else copy.unshift(updated);
            return copy.slice(0, 50);
          });
        }
        return;
      }

      if (type === "occupancy") {
        if (Array.isArray(payload)) setTheaterOcc(toTheaterOcc(payload));
        else if (payload) {
          setTheaterOcc((prev) => {
            const copy = [...prev];
            const i = copy.findIndex((t) => t.name === (payload.theaterName || payload.name));
            const updated = { name: payload.theaterName || payload.name, occupancy: Math.round(Number(payload.occupancyRate ?? 0) * 100) };
            if (i >= 0) copy[i] = updated;
            else copy.unshift(updated);
            return copy;
          });
        }
        return;
      }

      if (type === "summary") {
        setSummary((prev) => {
          const next = { ...prev };
          if (payload.revenueDelta) next.revenue30d = Number(prev.revenue30d || 0) + Number(payload.revenueDelta);
          if (payload.ordersDelta) next.orders = Number(prev.orders || 0) + Number(payload.ordersDelta);
          if (payload.aov != null) next.aov = payload.aov;
          if (payload.revenue7dDelta) next.revenue7d = Number(prev.revenue7d || 0) + Number(payload.revenue7dDelta);
          if (payload.dau != null) next.dau = payload.dau;
          return next;
        });
        return;
      }
    },
    [loadData, range]
  );

  // start SSE to /stream (outside /api/analytics). API_BASE points to /api/analytics,
  // so we compute streamUrl by replacing the tail.
  const baseRoot = API_BASE.replace(/\/api\/analytics$/, "") || API_BASE.replace(/\/+$/, "");
  const streamUrl = `${baseRoot}/api/analytics/stream`.replace(/\/+/g, "/").replace("http:/", "http://").replace("https:/", "https://");

  useRealtime({ url: streamUrl, onMessage: handleRealtimeMessage, enabled: true, pollFallbackMs: 30000, setLiveStatus });

  function exportCSV() {
    const csvEscape = (v) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // Export date as TEXT so Excel shows it immediately (no ##### and no auto formatting)
    const asExcelText = (s) => (s ? `'${String(s)}` : "");

    const makeCSV = (title, headers, rows) => {
      let csv = `${title}\n${headers.join(",")}\n`;
      csv += rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")).join("\n");
      csv += "\n\n";
      return csv;
    };

    // Build sections with ISO date column (text) + pretty label
    const revForCsv = revenueDaily.map((r) => ({
      date: asExcelText(r.dayISO || r.day),
      day: r.day,
      revenue: r.revenue,
      bookings: r.bookings,
    }));
    const dauForCsv = dauDaily.map((r) => ({
      date: asExcelText(r.dayISO || r.day),
      day: r.day,
      users: r.users,
    }));

    const sections = [];
    sections.push(makeCSV("Revenue (Daily)", ["date", "day", "revenue", "bookings"], revForCsv));
    sections.push(makeCSV("Active Users (Daily)", ["date", "day", "users"], dauForCsv));
    sections.push(makeCSV("Theater Occupancy", ["name", "occupancy"], theaterOcc));
    sections.push(makeCSV("Top Movies", ["title", "bookings", "revenue", "seatsBooked"], topMovies));

    const blob = new Blob(sections, { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `analytics_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-6">
        <HeaderBar
          range={range}
          setRange={setRange}
          onExport={exportCSV}
          onRefresh={() => loadData(range)}
          onToggleAlerts={() => alert("Alerts panel coming soon")}
          onToggleFilters={() => alert("Filters panel coming soon")}
          liveStatus={liveStatus}
        />

        {error && (
          <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{error}</Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat icon={CircleDollarSign} label={`Revenue (${range})`} value={formatCurrency(summary.revenue30d)} delta={0} />
          <Stat icon={ShoppingBag} label="Orders" value={formatInt(summary.orders)} delta={0} />
          <Stat icon={Gauge} label="Avg. Order Value" value={formatCurrency(summary.aov)} delta={0} />
          <Stat icon={BarChart3} label="Revenue (7d)" value={formatCurrency(summary.revenue7d)} />
          <Stat icon={Users} label="Avg DAU" value={formatInt(summary.dau)} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <ChartCard
              title="Daily Revenue"
              subtitle="Aggregate revenue per day"
              right={<Pill onClick={() => loadData(range)}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</Pill>}
            >
              {loading ? (
                <EmptyMini label="Loading revenue..." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueDaily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BLUE} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={BLUE} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={SOFT} opacity={0.45} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: SOFT }} stroke={SOFT} />
                    <YAxis tick={{ fontSize: 12, fill: SOFT }} domain={["dataMin", "auto"]} stroke={SOFT} />
                    <Tooltip formatter={(v, k) => (k === "revenue" ? formatCurrency(v) : formatInt(v))} />
                    <Area type="monotone" dataKey="revenue" stroke={BLUE} fill="url(#revFill)" strokeWidth={2} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="lg:col-span-2">
            <ChartCard title="Daily Active Users" subtitle="Unique users per day">
              {loading ? (
                <EmptyMini label="Loading users..." />
              ) : dauDaily && dauDaily.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dauDaily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={SOFT} opacity={0.45} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: SOFT }} stroke={SOFT} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: SOFT }} domain={[0, "auto"]} stroke={SOFT} />
                    <Tooltip formatter={(v) => formatInt(v)} />
                    <Line type="monotone" dataKey="users" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyMini label="No DAU yet — drive sign-ups and visits to see activity here." />
              )}
            </ChartCard>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SimpleTable
            title="Theater Occupancy (Avg)"
            rows={theaterOcc}
            columns={[
              { key: "name", label: "Theater", render: (v) => (<div className="flex items-center gap-2"><Building2 className="h-4 w-4" aria-hidden="true" /><span>{v}</span></div>) },
              { key: "occupancy", label: "Occupancy", render: (v) => `${formatInt(v)}%` },
            ]}
          />
          <SimpleTable
            title="Popular Movies"
            rows={topMovies}
            columns={[
              { key: "title", label: "Movie", render: (v) => (<div className="flex items-center gap-2"><Film className="h-4 w-4" aria-hidden="true" /><span>{v}</span></div>) },
              { key: "bookings", label: "Bookings", render: (v) => formatInt(v) },
              { key: "revenue", label: "Revenue", render: (v) => formatCurrency(v) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
