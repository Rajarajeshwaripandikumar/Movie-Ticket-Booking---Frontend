// frontend/src/pages/AdminAnalytics.jsx — Walmart Style (Blue, Rounded, Clean)
// Full analytics page with Alerts slide-over and Filters panel
import React, { useState, useEffect, useRef } from "react";
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

/* ======================== Config / API helpers ======================== */
function resolveApiBase() {
  // Analytics-specific base (keeps backward compatibility)
  const base =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080";
  // analytics endpoints live at /api/analytics
  const analyticsBase = `${base.replace(/\/+$/, "")}/api/analytics`;
  return analyticsBase;
}
const API_BASE = resolveApiBase();
// Root API (for notifications, theaters, movies etc)
const API_ROOT = API_BASE.replace(/\/api\/analytics$/, "").replace(/\/+$/, "");

const authHeaders = () => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params = {}, options = {}) {
  // options: { root: boolean, signal: AbortSignal }
  const base = options.root ? API_ROOT : API_BASE;
  const rel = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(rel, base + "/");
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const headers = { "Content-Type": "application/json", ...authHeaders() };
  const res = await fetch(url.toString(), { headers, signal: options.signal, credentials: "include" });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.message || ""; } catch {}
    const baseMsg = `HTTP ${res.status} ${res.statusText}`;
    throw new Error(detail ? `${baseMsg} — ${detail}` : baseMsg);
  }
  return res.json();
}

/* ======================== UI primitives & helpers ======================== */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";
const SOFT = "#94A3B8";

const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Pill = ({ children, className = "", ...props }) => (
  <button {...props} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}>
    {children}
  </button>
);

const Primary = ({ children, className = "", ...props }) => (
  <button {...props} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-[${BLUE}] text-white hover:bg-[${BLUE_DARK}] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}>
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
          className={`px-3 py-1.5 rounded-full text-sm transition ${value === r.id ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}
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

/* ======================== Data transforms (tolerant) ======================== */
const fmtDay = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d || "");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

const toRevenueDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || null;
    const revenue = Number(d.totalRevenue ?? d.total ?? d.revenue ?? 0);
    return { day: fmtDay(iso || `D${i + 1}`), dayISO: iso, revenue, bookings: Number(d.bookings ?? d.totalBookings ?? 0) };
  });

const toDauDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || null;
    return { day: fmtDay(iso || `D${i + 1}`), dayISO: iso, users: Number(d.dau ?? d.count ?? d.users ?? 0) };
  });

const toMovies = (arr = []) =>
  (arr || []).map((m = {}) => {
    const tryStr = (...vals) => { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return null; };
    const title = tryStr(m.movieName, m.movie, m.movieTitle, m.movie?.title, m.movie?.name, m.m?.title, m.m?.name, m.title, m.name, m.movieDoc?.title, m.movieDoc?.name) || (m.movieId ? String(m.movieId) : null) || "Unknown";
    return { title, revenue: Number(m.totalRevenue ?? m.total ?? m.revenue ?? 0), bookings: Number(m.totalBookings ?? m.bookings ?? 0), seatsBooked: Number(m.seatsBooked ?? 0) };
  });

const toTheaterOcc = (arr = []) =>
  (arr || []).map((t = {}) => {
    const raw = t.occupancy ?? t.occupancyRate ?? t.avgOccupancy ?? t.occupancyPercent ?? 0;
    let occPct = Number(raw ?? 0);
    if (occPct <= 1) occPct = occPct * 100;
    occPct = Math.round(Math.max(0, Math.min(100, occPct)));
    const name = t.theaterName ?? t.name ?? t.theater ?? t.theater_name ?? "Unknown";
    return { name, occupancy: occPct };
  });

function buildSummary(summaryData = [], dauData = [], revenue7 = 0) {
  const totals = (summaryData || []).reduce((acc, d) => { acc.revenue += Number(d.revenue ?? 0); acc.orders += Number(d.confirmed ?? 0); return acc; }, { revenue: 0, orders: 0 });
  const aov = totals.orders ? Math.round(totals.revenue / totals.orders) : 0;
  const avgDau = dauData && dauData.length ? Math.round((dauData.reduce((s, d) => s + Number(d.dau ?? d.count ?? 0), 0)) / dauData.length) : 0;
  return { revenue30d: totals.revenue, orders: totals.orders, aov, revenue7d: revenue7, dau: avgDau };
}

/* ======================== Main component ======================== */
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

  // Alerts + filter UI state
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [theaters, setTheaters] = useState([]);
  const [moviesList, setMoviesList] = useState([]);
  const [filters, setFilters] = useState({ theater: "", movie: "" });

  async function loadAlerts(signal) {
    try {
      const data = await getJSON("/notifications", {}, { root: true, signal });
      setAlerts(Array.isArray(data) ? data : data.notifications ?? []);
    } catch (e) {
      console.debug("failed to load alerts:", e.message || e);
    }
  }

  async function loadCatalogs(signal) {
    try {
      const [t, m] = await Promise.all([
        getJSON("/theaters", {}, { root: true, signal }).catch(() => []),
        getJSON("/movies", { limit: 200 }, { root: true, signal }).catch(() => []),
      ]);
      setTheaters(Array.isArray(t) ? t : []);
      const normMovies = (Array.isArray(m) ? m : []).map((mm) => ({ id: mm._id ?? mm.id ?? mm.movieId ?? null, title: mm.title ?? mm.name ?? mm.movieName ?? String(mm._id ?? mm.id ?? "") }));
      setMoviesList(normMovies);
    } catch (e) {
      console.debug("catalog load failed:", e.message || e);
    }
  }

  async function loadData(selectedRange, signal) {
    controllerRef.current?.abort();
    const controller = signal || new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    const days = daysOf(selectedRange);
    try {
      // include filters as query params targeting analytics routes (backend may ignore if not implemented)
      const params = { days, ...(filters.theater ? { theater: filters.theater } : {}), ...(filters.movie ? { movie: filters.movie } : {}) };

      const [revTrends, dau, movies, occ, bookSum, bookSum7] = await Promise.all([
        getJSON("/revenue/trends", params, { signal: controller.signal }),
        getJSON("/users/active", params, { signal: controller.signal }),
        getJSON("/movies/popular", { ...params, limit: movieLimit }, { signal: controller.signal }),
        getJSON("/occupancy", params, { signal: controller.signal }),
        getJSON("/bookings/summary", params, { signal: controller.signal }),
        getJSON("/bookings/summary", { days: 7 }, { signal: controller.signal }),
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
    const c = new AbortController();
    loadData(range, c);
    loadCatalogs(c.signal).catch(() => {});
    loadAlerts(c.signal).catch(() => {});
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, movieLimit, filters.theater, filters.movie]);

  // UI actions
  function exportCSV() {
    const csvEscape = (v) => { if (v === undefined || v === null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const makeCSV = (title, headers, rows) => { let csv = `${title}\n${headers.join(",")}\n`; csv += rows.map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(",")).join("\n"); csv += "\n\n"; return csv; };
    const sections = [];
    sections.push(makeCSV("Revenue (Daily)", ["day", "revenue", "bookings"], revenueDaily));
    sections.push(makeCSV("Active Users (Daily)", ["day", "users"], dauDaily));
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

  // Filters form handlers
  function applyFilters(e) {
    e?.preventDefault?.();
    setFiltersOpen(false);
    // loadData will re-run because filters state is in dependency
  }
  function resetFilters() {
    setFilters({ theater: "", movie: "" });
    setFiltersOpen(false);
  }

  // Alerts UI
  async function refreshAlerts() {
    const c = new AbortController();
    await loadAlerts(c.signal);
  }

  return (
    <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Admin Analytics</h1>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-600">Revenue, usage, and theater performance at a glance.</div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Pill onClick={() => { setAlertsOpen(true); refreshAlerts(); }}><Bell className="h-4 w-4" /> Alerts</Pill>
                <Pill onClick={() => { setFiltersOpen(true); }}><Filter className="h-4 w-4" /> Filter</Pill>
                <Primary onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Primary>
                <Pill onClick={() => loadData(range)}><RefreshCcw className="h-4 w-4" /> Refresh</Pill>
                <Segments value={range} onChange={setRange} />
              </div>
            </div>
          </Card>
        </div>

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
              {loading ? <EmptyMini label="Loading revenue..." /> : (
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
              {loading ? <EmptyMini label="Loading users..." /> : dauDaily && dauDaily.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dauDaily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={SOFT} opacity={0.45} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: SOFT }} stroke={SOFT} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: SOFT }} domain={[0, "auto"]} stroke={SOFT} />
                    <Tooltip formatter={(v) => formatInt(v)} />
                    <Line type="monotone" dataKey="users" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyMini label="No DAU yet — drive sign-ups and visits to see activity here." />}
            </ChartCard>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SimpleTable
            title="Theater Occupancy (Avg)"
            rows={theaterOcc}
            columns={[
              { key: "name", label: "Theater", render: (v) => (<div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><span>{v}</span></div>) },
              { key: "occupancy", label: "Occupancy", render: (v) => `${formatInt(v)}%` },
            ]}
          />

          <SimpleTable
            title="Popular Movies"
            rows={topMovies}
            columns={[
              { key: "title", label: "Movie", render: (v) => (<div className="flex items-center gap-2"><Film className="h-4 w-4" /><span>{v}</span></div>) },
              { key: "bookings", label: "Bookings", render: (v) => formatInt(v) },
              { key: "revenue", label: "Revenue", render: (v) => formatCurrency(v) },
            ]}
          />
        </div>
      </div>

      {/* Alerts slide-over */}
      {alertsOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setAlertsOpen(false)} />
          <div className="ml-auto w-full sm:w-[520px] h-full bg-white p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Alerts</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => refreshAlerts()} className="inline-flex items-center gap-1 px-3 py-1 rounded-full border">Refresh</button>
                <button onClick={() => setAlertsOpen(false)} className="rounded-full p-2"><X /></button>
              </div>
            </div>

            {alerts && alerts.length ? (
              <div className="space-y-3">
                {alerts.map((a, i) => (
                  <div key={a._id ?? i} className="p-3 border border-slate-100 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold">{a.title ?? a.message ?? "Alert"}</div>
                        <div className="text-xs text-slate-500 mt-1">{a.body ?? a.message ?? ""}</div>
                        <div className="text-xs text-slate-400 mt-2">{new Date(a.createdAt ?? a.created_at ?? Date.now()).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-600">No alerts</div>
            )}
          </div>
        </div>
      )}

      {/* Filters modal */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setFiltersOpen(false)} />
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} className="p-2 rounded-full"><X /></button>
            </div>

            <form onSubmit={applyFilters} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Theater</label>
                <select value={filters.theater} onChange={(e) => setFilters((s) => ({ ...s, theater: e.target.value }))} className="w-full border p-2 rounded">
                  <option value="">All theaters</option>
                  {theaters.map((t) => <option key={t._id ?? t.id} value={t._id ?? t.id}>{t.name ?? t.title ?? t.displayName ?? String(t._id ?? t.id)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Movie</label>
                <select value={filters.movie} onChange={(e) => setFilters((s) => ({ ...s, movie: e.target.value }))} className="w-full border p-2 rounded">
                  <option value="">All movies</option>
                  {moviesList.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={resetFilters} className="px-3 py-2 rounded-full border text-sm">Reset</button>
                <Primary type="submit">Apply</Primary>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
