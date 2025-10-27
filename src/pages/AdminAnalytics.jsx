// frontend/src/pages/AdminAnalytics.jsx — Walmart Style (Blue, Rounded, Clean)
// FULL FILE — patched to include Alerts drawer and Filters panel (client-side filters).
// - Alerts drawer fetches /api/notifications from backend root (AUTH header used if present).
// - Filters drawer allows simple theater/text filtering applied client-side to tables.
// - Uses robust API_BASE resolution and tolerant transforms from prior patch.
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CalendarRange,
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
  X,
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
   ========================================================================== */

/* ---------------------- API base + fetch helpers (robust) --------------------- */
// VITE_API_BASE should point to backend root (e.g. https://movie-ticket-booking-backend-o1m2.onrender.com)
function resolveApiBase() {
  const base =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080";
  return base.replace(/\/+$/, "");
}
const API_ROOT = resolveApiBase(); // e.g. https://backend
const ANALYTICS_PREFIX = "/api/analytics"; // analytics endpoints live here

const authHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params, signal) {
  // accept either "revenue/trends" or "/revenue/trends" or "/api/analytics/revenue/trends"
  const rel = path.startsWith("/") ? path : `/${path}`;
  const fullRel = rel.startsWith("/api/") ? rel : `${ANALYTICS_PREFIX}${rel}`;
  const base = API_ROOT.replace(/\/+$/, "") + "/";
  const url = new URL(fullRel.replace(/^\//, ""), base);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = { "Content-Type": "application/json", ...authHeaders() };
  console.debug("[analytics] fetch ->", url.toString(), { headers });

  const res = await fetch(url.toString(), {
    headers,
    signal,
    credentials: "include",
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.message || "";
    } catch (e) {}
    const baseMsg = `HTTP ${res.status} ${res.statusText}`;
    throw new Error(detail ? `${baseMsg} — ${detail}` : baseMsg);
  }
  return res.json();
}

// helper to fetch non-analytics endpoints (notifications, theaters, etc.)
async function fetchRootJSON(path, params, signal) {
  const rel = path.startsWith("/") ? path : `/${path}`;
  const base = API_ROOT.replace(/\/+$/, "") + "/";
  const url = new URL(rel.replace(/^\//, ""), base);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers = { "Content-Type": "application/json", ...authHeaders() };
  const res = await fetch(url.toString(), {
    headers,
    signal,
    credentials: "include",
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.message || "";
    } catch (e) {}
    const baseMsg = `HTTP ${res.status} ${res.statusText}`;
    throw new Error(detail ? `${baseMsg} — ${detail}` : baseMsg);
  }
  return res.json();
}

/* ----------------------------- Walmart tokens ----------------------------- */
const BLUE = "#0071DC"; // Walmart Blue
const BLUE_DARK = "#0654BA"; // Hover/active
const INK = "#0F172A"; // Slate-900
const SOFT = "#94A3B8"; // Slate-400 for ticks/grid

/* --------------------------- UI primitives & helpers --------------------------- */
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
            value === r.id ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"
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
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `₹${v.toLocaleString("en-IN")}`;
  }
}
const formatInt = (n) => (Number.isFinite(+n) ? Math.round(+n).toLocaleString("en-IN") : "0");

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

const HeaderBar = ({
  range,
  setRange,
  onRefresh,
  onExport,
  onToggleAlerts,
  onToggleFilters,
}) => (
  <div className="space-y-3">
    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Admin Analytics</h1>
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
                  <td key={c.key} className="py-2">{c.render ? c.render(r[c.key], r) : r[c.key]}</td>
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

/* ---------------------------- data transforms ---------------------------- */
const fmtDay = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d || "");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

const toRevenueDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || null;
    const revenue = Number(d.totalRevenue ?? d.total ?? d.revenue ?? 0);
    return { day: fmtDay(iso || `D${i + 1}`), dayISO: iso, revenue, bookings: Number(d.bookings ?? d.totalBookings ?? d.bookings ?? 0) };
  });

const toDauDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || null;
    return { day: fmtDay(iso || `D${i + 1}`), dayISO: iso, users: Number(d.dau ?? d.count ?? d.users ?? 0) };
  });

const toMovies = (arr = []) =>
  (arr || []).map((m = {}) => ({
    title: m.movieName ?? m.movie ?? m.movieName ?? m.title ?? "Unknown",
    revenue: Number(m.totalRevenue ?? m.total ?? m.revenue ?? 0),
    bookings: Number(m.totalBookings ?? m.bookings ?? m.bookings ?? 0),
    seatsBooked: Number(m.seatsBooked ?? 0),
  }));

const toTheaterOcc = (arr = []) =>
  (arr || []).map((t = {}) => ({
    name: t.theaterName ?? t.name ?? t.theater ?? "Unknown",
    occupancy: Math.round((Number(t.occupancyRate ?? t.occupancy ?? 0) || 0) * 100),
  }));

function buildSummary(summaryData = [], dauData = [], revenue7 = 0) {
  const totals = (summaryData || []).reduce((acc, d) => {
    acc.revenue += Number(d.revenue ?? 0);
    acc.orders += Number(d.confirmed ?? 0);
    return acc;
  }, { revenue: 0, orders: 0 });
  const aov = totals.orders ? Math.round(totals.revenue / totals.orders) : 0;
  const avgDau = dauData && dauData.length ? Math.round((dauData.reduce((s, d) => s + Number(d.dau ?? d.count ?? 0), 0)) / dauData.length) : 0;
  return { revenue30d: totals.revenue, orders: totals.orders, aov, revenue7d: revenue7, dau: avgDau };
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

  // Alerts drawer state
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const alertsController = useRef(null);

  // Filters drawer state (client-side filters)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterTheater, setFilterTheater] = useState("");
  const [availableTheaters, setAvailableTheaters] = useState([]);
  const theatersController = useRef(null);

  // Derived filtered data (client-side)
  const filteredTheaterOcc = useMemo(() => {
    let rows = theaterOcc || [];
    if (filterTheater) rows = rows.filter((r) => String(r.name).toLowerCase().includes(String(filterTheater).toLowerCase()));
    if (filterText) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(filterText.toLowerCase()));
    return rows;
  }, [theaterOcc, filterTheater, filterText]);

  const filteredTopMovies = useMemo(() => {
    let rows = topMovies || [];
    if (filterText) rows = rows.filter((r) => (r.title || "").toLowerCase().includes(filterText.toLowerCase()));
    return rows;
  }, [topMovies, filterText]);

  async function loadData(selectedRange) {
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

      const revenueDailyT = toRevenueDaily(revTrends || []);
      const dauDailyT = toDauDaily(dau || []);
      const moviesT = toMovies(movies || []);
      const occT = toTheaterOcc(occ || []);
      const revenue7 = (bookSum7 || []).reduce((s, d) => s + Number(d.revenue ?? 0), 0);
      const kpis = buildSummary(bookSum || [], dau || [], revenue7);

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
  }

  useEffect(() => {
    loadData(range);
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, movieLimit]);

  /* -------------------- Alerts (notifications) -------------------- */
  async function openAlerts() {
    setAlertsOpen(true);
    await loadNotifications();
  }

  async function loadNotifications() {
    alertsController.current?.abort();
    const controller = new AbortController();
    alertsController.current = controller;
    setAlertsLoading(true);
    try {
      // backend notifications route mounted at /api/notifications
      const data = await fetchRootJSON("/api/notifications", null, controller.signal);
      // Accept either object { items: [...] } or array
      const items = Array.isArray(data) ? data : data?.items || data?.notifications || [];
      setNotifications(items);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Failed to load notifications:", e);
      setNotifications([]);
    } finally {
      setAlertsLoading(false);
    }
  }

  /* -------------------- Filters (theaters list) -------------------- */
  async function openFilters() {
    setFiltersOpen(true);
    await loadTheaters();
  }

  async function loadTheaters() {
    theatersController.current?.abort();
    const controller = new AbortController();
    theatersController.current = controller;
    try {
      // backend theaters route mounted at /api/theaters
      const data = await fetchRootJSON("/api/theaters", null, controller.signal);
      // Accept array or { items: [...] }
      const items = Array.isArray(data) ? data : data?.items || data?.theaters || [];
      setAvailableTheaters(items.map((t) => ({ id: t._id ?? t.id ?? String(t.id || t._id || t.name), name: t.name ?? t.title ?? t.displayName ?? "Unknown" })));
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Failed to load theaters:", e);
      setAvailableTheaters([]);
    }
  }

  function applyFilters() {
    // Filters applied client-side via filteredTheaterOcc and filteredTopMovies
    setFiltersOpen(false);
  }

  function clearFilters() {
    setFilterText("");
    setFilterTheater("");
  }

  function exportCSV() {
    const csvEscape = (v) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const makeCSV = (title, headers, rows) => {
      let csv = `${title}\n${headers.join(",")}\n`;
      csv += rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")).join("\n");
      csv += "\n\n";
      return csv;
    };
    const sections = [];
    sections.push(makeCSV("Revenue (Daily)", ["day", "revenue", "bookings"], revenueDaily));
    sections.push(makeCSV("Active Users (Daily)", ["day", "users"], dauDaily));
    sections.push(makeCSV("Theater Occupancy", ["name", "occupancy"], filteredTheaterOcc));
    sections.push(makeCSV("Top Movies", ["title", "bookings", "revenue", "seatsBooked"], filteredTopMovies));

    const blob = new Blob(sections, { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `analytics_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-6">
          <HeaderBar
            range={range}
            setRange={setRange}
            onExport={exportCSV}
            onRefresh={() => loadData(range)}
            onToggleAlerts={() => openAlerts()}
            onToggleFilters={() => openFilters()}
          />

          {error && <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{error}</Card>}

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
              <ChartCard title="Daily Revenue" subtitle="Aggregate revenue per day" right={<Pill onClick={() => loadData(range)}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</Pill>}>
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
              rows={filteredTheaterOcc}
              columns={[
                {
                  key: "name",
                  label: "Theater",
                  render: (v) => (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      <span>{v}</span>
                    </div>
                  ),
                },
                { key: "occupancy", label: "Occupancy", render: (v) => `${formatInt(v)}%` },
              ]}
            />

            <SimpleTable
              title="Popular Movies"
              rows={filteredTopMovies}
              columns={[
                {
                  key: "title",
                  label: "Movie",
                  render: (v) => (
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4" aria-hidden="true" />
                      <span>{v}</span>
                    </div>
                  ),
                },
                { key: "bookings", label: "Bookings", render: (v) => formatInt(v) },
                { key: "revenue", label: "Revenue", render: (v) => formatCurrency(v) },
              ]}
            />
          </div>
        </div>
      </div>

      {/* -------------------- Alerts Drawer -------------------- */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[520px] max-w-full z-50 transform transition-transform duration-200 ${
          alertsOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!alertsOpen}
      >
        <div className="h-full bg-white shadow-2xl border-l border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Alerts</h3>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded-md hover:bg-slate-100" onClick={loadNotifications} title="Refresh">
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button className="px-2 py-1 rounded-md hover:bg-slate-100" onClick={() => setAlertsOpen(false)} title="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {alertsLoading ? (
            <div className="text-sm text-slate-600">Loading alerts…</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-sm text-slate-600">No alerts found.</div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100%-96px)] pr-2">
              {notifications.map((n, i) => (
                <div key={n._id ?? n.id ?? i} className="p-3 border rounded-lg bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{n.title ?? n.subject ?? n.message?.slice?.(0, 40) ?? "Alert"}</div>
                      <div className="text-xs text-slate-600 mt-1">{n.message ?? n.body ?? ""}</div>
                    </div>
                    <div className="text-xs text-slate-500">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* -------------------- Filters Drawer -------------------- */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] max-w-full z-40 transform transition-transform duration-200 ${
          filtersOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!filtersOpen}
      >
        <div className="h-full bg-white shadow-2xl border-l border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Filters</h3>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded-md hover:bg-slate-100" onClick={clearFilters} title="Clear">
                Clear
              </button>
              <button className="px-2 py-1 rounded-md hover:bg-slate-100" onClick={() => setFiltersOpen(false)} title="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[calc(100%-96px)] overflow-y-auto pr-2">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Search text</label>
              <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter theaters or movies" className="w-full px-3 py-2 border rounded-md" />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Theater</label>
              <select value={filterTheater} onChange={(e) => setFilterTheater(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                <option value="">— All theaters —</option>
                {availableTheaters.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-500 mt-1">Theater list is fetched from backend; if empty try Refresh.</div>
            </div>

            <div className="flex gap-2">
              <Primary onClick={applyFilters} className="flex-1">Apply</Primary>
              <button onClick={() => { setFiltersOpen(false); }} className="px-4 py-2 rounded-full border border-slate-200">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* small backdrop to close drawers */}
      {(alertsOpen || filtersOpen) && (
        <div
          onClick={() => { setAlertsOpen(false); setFiltersOpen(false); }}
          className="fixed inset-0 bg-black/30 z-30"
        />
      )}
    </>
  );
}
