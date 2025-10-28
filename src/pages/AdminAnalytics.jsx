// frontend/src/pages/AdminAnalytics.jsx
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

/* ======================== API base helpers ======================== */
function resolveApiBase() {
  const raw =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080";

  let base = String(raw).replace(/\/+$/, "");
  // remove any trailing /api/... to get root
  base = base.replace(/\/api(\/.*)?$/i, "");
  const API_ROOT = `${base}/api`.replace(/\/+$/, "");
  const API_BASE = `${API_ROOT}/analytics`.replace(/\/+$/, "");
  return { API_BASE, API_ROOT };
}
const { API_BASE, API_ROOT } = resolveApiBase();

const authHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params = {}, options = {}) {
  // options: { root: boolean, signal: AbortSignal }
  const base = options.root ? API_ROOT : API_BASE;
  const rel = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(rel, base + "/");
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    signal: options.signal,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "";
    try {
      msg = (await res.json())?.message || "";
    } catch {}
    throw new Error(`HTTP ${res.status}: ${msg || res.statusText}`);
  }
  return res.json();
}

/* ======================== Styling primitives ======================== */
const BLUE = "#0071DC";
const SOFT = "#94A3B8";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);
const Pill = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-slate-800 border border-slate-200 hover:bg-slate-50 ${className}`}
  >
    {children}
  </button>
);
const Primary = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white`} 
    style={{ backgroundColor: BLUE }}
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

/* ======================== Formatters & transforms ======================== */
const formatCurrency = (n) => {
  const v = Number.isFinite(+n) ? +n : 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `₹${v.toLocaleString("en-IN")}`;
  }
};
const formatInt = (n) => (Number.isFinite(+n) ? Math.round(+n).toLocaleString("en-IN") : "0");

const fmtDay = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d || "");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
};

const toRevenueDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || d?._id || `D${i + 1}`;
    const revenue = Number(d.totalRevenue ?? d.total ?? d.revenue ?? 0);
    return { day: fmtDay(iso), dayISO: iso, revenue, bookings: Number(d.bookings ?? d.totalBookings ?? 0) };
  });

const toDauDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso = d?.date?.slice?.(0, 10) || d?.dayISO || d?.day || d?._id || `D${i + 1}`;
    return { day: fmtDay(iso), dayISO: iso, users: Number(d.dau ?? d.count ?? d.users ?? 0) };
  });

const toMovies = (arr = []) =>
  (arr || []).map((m = {}) => {
    const title =
      m.movieName ||
      m.movieTitle ||
      m.title ||
      (m.movie && (m.movie.title || m.movie.name)) ||
      (m.m && (m.m.title || m.m.name)) ||
      (m.movieId ? String(m.movieId) : "Unknown");
    const revenue = Number(m.totalRevenue ?? m.total ?? m.revenue ?? 0);
    const bookings = Number(m.totalBookings ?? m.bookings ?? 0);
    return { title, revenue, bookings, seatsBooked: Number(m.seatsBooked ?? 0) };
  });

const toTheaterOcc = (arr = []) =>
  (arr || []).map((t = {}) => {
    const raw = t.occupancy ?? t.occupancyRate ?? t.avgOccupancy ?? t.occupancyPercent ?? 0;
    let occPct = Number(raw ?? 0);
    if (!Number.isFinite(occPct)) occPct = 0;
    if (occPct <= 1) occPct = occPct * 100;
    occPct = Math.round(Math.max(0, Math.min(100, occPct)));
    const name = t.theaterName ?? t.name ?? t.theater ?? t.theater_name ?? "Unknown";
    return { name, occupancy: occPct, totalBooked: t.totalBooked ?? 0, totalCapacity: t.totalCapacity ?? 0 };
  });

/* ======================== Main Component ======================== */
export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({ revenue30d: 0, orders: 0, aov: 0, revenue7d: 0, dau: 0 });
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dauDaily, setDauDaily] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [theaterOcc, setTheaterOcc] = useState([]);

  // catalogs + filters
  const [theaters, setTheaters] = useState([]);
  const [moviesList, setMoviesList] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ theater: "", movie: "" });

  // alerts
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const controllerRef = useRef(null);
  const daysOf = (id) => ranges.find((r) => r.id === id)?.days ?? 30;

  useEffect(() => {
    // load catalogs for filter selects and alerts
    const c = new AbortController();
    loadCatalogs(c.signal);
    loadAlerts(c.signal);
    loadData(range, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, filters.theater, filters.movie]);

  async function loadCatalogs(signal) {
    try {
      const [t, m] = await Promise.all([
        getJSON("/theaters", {}, { root: true, signal }).catch(() => []),
        getJSON("/movies", { limit: 500 }, { root: true, signal }).catch(() => []),
      ]);
      setTheaters(Array.isArray(t) ? t : []);
      const norm = (Array.isArray(m) ? m : []).map((mm) => ({
        id: mm._id ?? mm.id ?? mm.movieId ?? null,
        title: mm.title ?? mm.name ?? mm.movieName ?? String(mm._id ?? mm.id ?? ""),
      }));
      setMoviesList(norm);
    } catch (e) {
      console.debug("catalog load failed:", e.message || e);
    }
  }

  async function loadAlerts(signal) {
    try {
      const data = await getJSON("/notifications", {}, { root: true, signal }).catch(() => []);
      setAlerts(Array.isArray(data) ? data : data.notifications ?? []);
    } catch (e) {
      // ignore
    }
  }

  function ensureController(input) {
    if (!input) return new AbortController();
    if ("signal" in input && typeof input.abort === "function") return input;
    return new AbortController();
  }

  async function loadData(selectedRange, providedSignal) {
    controllerRef.current?.abort?.();
    const controller = ensureController(providedSignal);
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const days = daysOf(selectedRange);
      const params = { days, ...(filters.theater ? { theater: filters.theater } : {}), ...(filters.movie ? { movie: filters.movie } : {}) };

      const [revTrends, dau, movies, occ, bookSum, bookSum7] = await Promise.all([
        getJSON("/revenue/trends", params, { signal: controller.signal }),
        getJSON("/users/active", params, { signal: controller.signal }),
        getJSON("/movies/popular", { ...params, limit: 10 }, { signal: controller.signal }),
        getJSON("/occupancy", params, { signal: controller.signal }),
        getJSON("/bookings/summary", params, { signal: controller.signal }),
        getJSON("/bookings/summary", { days: 7 }, { signal: controller.signal }),
      ]);

      setRevenueDaily(toRevenueDaily(revTrends || []));
      setDauDaily(toDauDaily(dau || []));
      setTopMovies(toMovies(movies || []));
      setTheaterOcc(toTheaterOcc(occ || []));

      const revenue30 = (bookSum || []).reduce((s, d) => s + Number(d.revenue ?? 0), 0);
      const orders = (bookSum || []).reduce((s, d) => s + Number(d.confirmed ?? d.confirmed ?? 0), 0);
      const aov = orders ? Math.round(revenue30 / orders) : 0;
      const revenue7 = (bookSum7 || []).reduce((s, d) => s + Number(d.revenue ?? 0), 0);
      const avgDau = (dau || []).length ? Math.round((dau || []).reduce((s, d) => s + Number(d.dau ?? d.count ?? d.users ?? 0), 0) / dau.length) : 0;

      setSummary({ revenue30d: revenue30, orders, aov, revenue7d: revenue7, dau: avgDau });
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Analytics load failed:", e);
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  /* ================== CSV Export (multi-section) ================== */
  function exportCSV() {
    const csvEscape = (v) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const makeCSV = (title, headers, rows) => {
      let csv = `${title}\n${headers.join(",")}\n`;
      csv += rows
        .map((r) =>
          headers.map((h) => csvEscape(r[h] ?? "")).join(",")
        )
        .join("\n");
      csv += "\n\n";
      return csv;
    };

    // Prepare rows with explicit dayISO fields so Excel can parse dates reliably.
    const revRows = (revenueDaily || []).map((r) => ({
      dayISO: r.dayISO || "",
      day: r.day || "",
      revenue: r.revenue ?? 0,
      bookings: r.bookings ?? 0,
    }));
    const dauRows = (dauDaily || []).map((r) => ({
      dayISO: r.dayISO || "",
      day: r.day || "",
      users: r.users ?? 0,
    }));
    const occRows = (theaterOcc || []).map((r) => ({
      name: r.name ?? "",
      occupancy: r.occupancy ?? "",
      totalBooked: r.totalBooked ?? "",
      totalCapacity: r.totalCapacity ?? "",
    }));
    const movieRows = (topMovies || []).map((r) => ({
      title: r.title ?? "",
      bookings: r.bookings ?? 0,
      revenue: r.revenue ?? 0,
      seatsBooked: r.seatsBooked ?? 0,
    }));

    const sections = [];
    sections.push(makeCSV("Revenue (Daily)", ["dayISO", "day", "revenue", "bookings"], revRows));
    sections.push(makeCSV("Active Users (Daily)", ["dayISO", "day", "users"], dauRows));
    sections.push(makeCSV("Theater Occupancy", ["name", "occupancy", "totalBooked", "totalCapacity"], occRows));
    sections.push(makeCSV("Top Movies", ["title", "bookings", "revenue", "seatsBooked"], movieRows));

    // Prepend UTF-8 BOM so Excel (Windows) recognizes UTF-8 and date columns better.
    const csvContent = "\uFEFF" + sections.join("");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `analytics_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ================== Filters handlers ================== */
  function applyFilters(e) {
    e?.preventDefault?.();
    setFiltersOpen(false);
    // loadData will run via useEffect watching filters
  }
  function resetFilters() {
    setFilters({ theater: "", movie: "" });
    setFiltersOpen(false);
  }

  async function refreshAlerts() {
    const c = new AbortController();
    await loadAlerts(c.signal);
  }

  /* ================== Render ================== */
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
                <Pill onClick={() => setFiltersOpen(true)}><Filter className="h-4 w-4" /> Filter</Pill>
                <Primary onClick={exportCSV}><Download className="h-4 w-4" /> Export CSV</Primary>
                <Pill onClick={() => loadData(range)}><RefreshCcw className="h-4 w-4" /> Refresh</Pill>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
                  {ranges.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition ${range === r.id ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}
                      aria-pressed={range === r.id}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {error && <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{error}</Card>}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat icon={CircleDollarSign} label={`Revenue (${range})`} value={formatCurrency(summary.revenue30d)} />
          <Stat icon={ShoppingBag} label="Orders" value={formatInt(summary.orders)} />
          <Stat icon={Gauge} label="Avg. Order Value" value={formatCurrency(summary.aov)} />
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
                  {theaters.map((t) => <option key={t._id ?? t.id} value={t._id ?? t.id}>{t.name ?? t.title ?? String(t._id ?? t.id)}</option>)}
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

/* ======================== small subcomponents ======================== */
function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
            <Icon className="h-5 w-5 text-slate-900" />
          </span>
          <div>
            <p className="text-xs text-slate-600">{label}</p>
            <p className="text-xl font-extrabold text-slate-900">{value}</p>
          </div>
        </div>
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
