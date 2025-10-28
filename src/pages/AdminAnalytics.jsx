// frontend/src/pages/AdminAnalytics.jsx
import React, { useState, useEffect, useRef } from "react";
import {
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
  base = base.replace(/\/api(\/.*)?$/i, "");
  const API_ROOT = `${base}/api`.replace(/\/+$/, "");
  const API_BASE = `${API_ROOT}/analytics`.replace(/\/+$/, "");
  return { API_BASE, API_ROOT };
}
const { API_BASE, API_ROOT } = resolveApiBase();

const authHeaders = () => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params = {}, options = {}) {
  const base = options.root ? API_ROOT : API_BASE;
  const rel = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(rel, base + "/");
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "")
      url.searchParams.set(k, String(v));
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

/* ======================== Styling ======================== */
const BLUE = "#0071DC";
const SOFT = "#94A3B8";

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
  >
    {children}
  </div>
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

/* ======================== Helpers ======================== */
const formatCurrency = (n) => {
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
};
const formatInt = (n) =>
  Number.isFinite(+n) ? Math.round(+n).toLocaleString("en-IN") : "0";

const fmtDay = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return String(d || "");
  return dt
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

/* Map backend arrays into chart/CSV-ready formats */
const toRevenueDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso =
      d?.date?.slice?.(0, 10) ||
      d?.dayISO ||
      d?.day ||
      d?._id ||
      `D${i + 1}`;
    const revenue = Number(d.totalRevenue ?? d.total ?? d.revenue ?? 0);
    return {
      day: fmtDay(iso),
      dayISO: iso,
      revenue,
      bookings: Number(d.bookings ?? d.totalBookings ?? 0),
    };
  });

const toDauDaily = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso =
      d?.date?.slice?.(0, 10) ||
      d?.dayISO ||
      d?.day ||
      d?._id ||
      `D${i + 1}`;
    return {
      day: fmtDay(iso),
      dayISO: iso,
      users: Number(d.dau ?? d.count ?? d.users ?? 0),
    };
  });

const toMovies = (arr = []) =>
  (arr || []).map((m = {}) => {
    const title =
      m.movieName ||
      m.movieTitle ||
      m.title ||
      (m.movie && (m.movie.title || m.movie.name)) ||
      "Unknown";
    const revenue = Number(m.totalRevenue ?? m.total ?? m.revenue ?? 0);
    const bookings = Number(m.totalBookings ?? m.bookings ?? 0);
    return {
      title,
      revenue,
      bookings,
      seatsBooked: Number(m.seatsBooked ?? 0),
    };
  });

const toTheaterOcc = (arr = []) =>
  (arr || []).map((t = {}) => {
    const raw =
      t.occupancy ??
      t.occupancyRate ??
      t.avgOccupancy ??
      t.occupancyPercent ??
      0;
    let occPct = Number(raw ?? 0);
    if (!Number.isFinite(occPct)) occPct = 0;
    if (occPct <= 1) occPct = occPct * 100;
    occPct = Math.round(Math.max(0, Math.min(100, occPct)));
    const name =
      t.theaterName ?? t.name ?? t.theater ?? t.theater_name ?? "Unknown";
    return {
      name,
      occupancy: occPct,
      totalBooked: t.totalBooked ?? 0,
      totalCapacity: t.totalCapacity ?? 0,
    };
  });

/* ======================== Main Component ======================== */
export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    revenue30d: 0,
    orders: 0,
    aov: 0,
    revenue7d: 0,
    dau: 0,
  });
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dauDaily, setDauDaily] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [theaterOcc, setTheaterOcc] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ theater: "", movie: "" });
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const controllerRef = useRef(null);
  const lastRawRef = useRef({});

  const daysOf = (id) => ranges.find((r) => r.id === id)?.days ?? 30;

  useEffect(() => {
    const c = new AbortController();
    loadData(range, c.signal);
    return () => c.abort();
  }, []);

  useEffect(() => {
    loadData(range);
  }, [range, filters.theater, filters.movie]);

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
      const params = {
        days,
        ...(filters.theater ? { theater: filters.theater } : {}),
        ...(filters.movie ? { movie: filters.movie } : {}),
      };

      const [revTrends, dau, movies, occ, bookSum, bookSum7] =
        await Promise.all([
          getJSON("/revenue/trends", params, { signal: controller.signal }),
          getJSON("/users/active", params, { signal: controller.signal }),
          getJSON("/movies/popular", { ...params, limit: 10 }, { signal: controller.signal }),
          getJSON("/occupancy", params, { signal: controller.signal }),
          getJSON("/bookings/summary", params, { signal: controller.signal }),
          getJSON("/bookings/summary", { days: 7 }, { signal: controller.signal }),
        ]);

      lastRawRef.current = { revTrends, dau, movies, occ, bookSum, bookSum7 };
      console.log("DEBUG raw revTrends:", revTrends);

      setRevenueDaily(toRevenueDaily(revTrends || []));
      setDauDaily(toDauDaily(dau || []));
      setTopMovies(toMovies(movies || []));
      setTheaterOcc(toTheaterOcc(occ || []));

      const revenue30 = (bookSum || []).reduce(
        (s, d) => s + Number(d.revenue ?? 0),
        0
      );
      const orders = (bookSum || []).reduce(
        (s, d) => s + Number(d.confirmed ?? d.confirmed ?? 0),
        0
      );
      const aov = orders ? Math.round(revenue30 / orders) : 0;
      const revenue7 = (bookSum7 || []).reduce(
        (s, d) => s + Number(d.revenue ?? 0),
        0
      );
      const avgDau = (dau || []).length
        ? Math.round(
            (dau || []).reduce(
              (s, d) => s + Number(d.dau ?? d.count ?? d.users ?? 0),
              0
            ) / dau.length
          )
        : 0;

      setSummary({
        revenue30d: revenue30,
        orders,
        aov,
        revenue7d: revenue7,
        dau: avgDau,
      });
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Analytics load failed:", e);
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  /* ================== CSV Export (Excel-safe + Debug) ================== */
  function exportCSV() {
    const csvEscape = (v) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const wrapExcelText = (s) =>
      !s ? "" : `="${String(s)}"`; // Excel-safe

    const makeCSV = (title, headers, rows) => {
      let csv = `${title}\n${headers.join(",")}\n`;
      csv += rows
        .map((r) => headers.map((h) => csvEscape(r[h] ?? "")).join(","))
        .join("\n");
      csv += "\n\n";
      return csv;
    };

    const revRows = (revenueDaily || []).map((r) => ({
      dayISO: wrapExcelText(r.dayISO || ""),
      day: wrapExcelText(r.day || ""),
      revenue: r.revenue ?? 0,
      bookings: r.bookings ?? 0,
    }));
    const dauRows = (dauDaily || []).map((r) => ({
      dayISO: wrapExcelText(r.dayISO || ""),
      day: wrapExcelText(r.day || ""),
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

    console.log("DEBUG revRows:", revRows);
    console.log("DEBUG dauRows:", dauRows);

    const sections = [];
    sections.push(
      makeCSV("Revenue (Daily)", ["dayISO", "day", "revenue", "bookings"], revRows)
    );
    sections.push(
      makeCSV("Active Users (Daily)", ["dayISO", "day", "users"], dauRows)
    );
    sections.push(
      makeCSV(
        "Theater Occupancy",
        ["name", "occupancy", "totalBooked", "totalCapacity"],
        occRows
      )
    );
    sections.push(
      makeCSV(
        "Top Movies",
        ["title", "bookings", "revenue", "seatsBooked"],
        movieRows
      )
    );

    const csvContent = "\uFEFF" + sections.join("");
    console.log("DEBUG CSV start:", csvContent.slice(0, 500));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank"); // for preview
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `analytics_${range}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ================== UI ================== */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Admin Analytics</h1>
          <Primary onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Primary>
        </div>

        {error && (
          <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
            {error}
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat
            icon={CircleDollarSign}
            label={`Revenue (${range})`}
            value={formatCurrency(summary.revenue30d)}
          />
          <Stat
            icon={ShoppingBag}
            label="Orders"
            value={formatInt(summary.orders)}
          />
          <Stat
            icon={Gauge}
            label="Avg. Order Value"
            value={formatCurrency(summary.aov)}
          />
          <Stat
            icon={BarChart3}
            label="Revenue (7d)"
            value={formatCurrency(summary.revenue7d)}
          />
          <Stat icon={Users} label="Avg DAU" value={formatInt(summary.dau)} />
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Revenue (Daily)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueDaily}>
              <CartesianGrid strokeDasharray="3 3" stroke={SOFT} opacity={0.4} />
              <XAxis dataKey="day" stroke={SOFT} />
              <YAxis stroke={SOFT} />
              <Tooltip />
              <Area
                dataKey="revenue"
                stroke={BLUE}
                fill={BLUE}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ======================== small subcomponents ======================== */
function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
          <Icon className="h-5 w-5 text-slate-900" />
        </span>
        <div>
          <p className="text-xs text-slate-600">{label}</p>
          <p className="text-xl font-extrabold text-slate-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}
