// frontend/src/pages/AdminAnalytics.jsx — Walmart Style (Blue, Rounded, Clean)
// Fixed version: prevents 501 spam by enabling SSE only when backend supports it

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
   Admin Analytics wired to Express backend
   Composite:  GET /api/analytics?days=N → { revenue, users, occupancy, popularMovies, debug }
   SSE:        GET /api/analytics/stream?token=... (optional, only if backend supports)
   ========================================================================== */

function resolveApiBase() {
  const raw =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8080";

  let base = String(raw).replace(/\/+$/, "");
  base = base.replace(/\/api\/analytics$/i, "").replace(/\/api$/i, "");
  return `${base}/api/analytics`;
}
const API_BASE = resolveApiBase();

const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";
const SOFT = "#94A3B8";

/* ─────────────────────────────── UI Components ─────────────────────────────── */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Pill = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
  >
    {children}
  </button>
);

const Primary = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-[#0071DC] text-white hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
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
            value === r.id
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function formatCurrency(n) {
  const v = Number.isFinite(+n) ? +n : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
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
            <Icon className="h-5 w-5 text-slate-900" />
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

/* ─────────────────────────────── Helpers ─────────────────────────────── */
const authHeaders = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function getJSON(path, params, signal) {
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    signal,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─────────────────────────────── Main ─────────────────────────────── */
export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ revenue30d: 0, orders: 0, aov: 0, revenue7d: 0, dau: 0 });
  const [revenueDaily, setRevenueDaily] = useState([]);
  const [dauDaily, setDauDaily] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [theaterOcc, setTheaterOcc] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [streamAvailable, setStreamAvailable] = useState(false); // ✅ Added

  const controllerRef = useRef(null);
  const daysOf = (id) => ranges.find((r) => r.id === id)?.days ?? 30;

  const loadData = useCallback(
    async (selectedRange) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError("");
      const days = daysOf(selectedRange);

      try {
        const composite = await getJSON("/", { days }, controller.signal);

        if (composite) {
          // ✅ detect backend SSE availability
          if (typeof composite.streamAvailable !== "undefined")
            setStreamAvailable(Boolean(composite.streamAvailable));

          setRevenueDaily(composite.revenue || []);
          setDauDaily(composite.users || []);
          setTopMovies(composite.popularMovies || []);
          setTheaterOcc(composite.occupancy || []);
          if (composite.debug) setDebugInfo(composite.debug);
        }
      } catch (e) {
        console.error("Analytics load failed:", e);
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(range);
    return () => controllerRef.current?.abort();
  }, [range, loadData]);

  /* Realtime setup (only if backend supports) */
  const tokenForStream = localStorage.getItem("token") || "";
  const API_ROOT = API_BASE.replace(/\/api\/analytics\/?$/i, "").replace(/\/+$/, "");
  const streamUrl = `${API_ROOT}/api/analytics/stream${tokenForStream ? `?token=${encodeURIComponent(tokenForStream)}` : ""}`;
  const sseEnabled = Boolean(streamAvailable && tokenForStream);

  useEffect(() => {
    if (!sseEnabled) return;
    const es = new EventSource(streamUrl, { withCredentials: true });
    es.onopen = () => setLiveStatus("connected");
    es.onerror = () => setLiveStatus("disconnected");
    es.onmessage = (ev) => {
      console.debug("[SSE]", ev.data);
    };
    return () => es.close();
  }, [sseEnabled, streamUrl]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Admin Analytics</h1>
          <Segments value={range} onChange={setRange} />
        </div>

        {error && <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700">{error}</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat icon={CircleDollarSign} label={`Revenue (${range})`} value={formatCurrency(summary.revenue30d)} />
          <Stat icon={ShoppingBag} label="Orders" value={formatInt(summary.orders)} />
          <Stat icon={Gauge} label="Avg Order" value={formatCurrency(summary.aov)} />
          <Stat icon={BarChart3} label="Revenue (7d)" value={formatCurrency(summary.revenue7d)} />
          <Stat icon={Users} label="Avg DAU" value={formatInt(summary.dau)} />
        </div>

        <Card className="p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Status</h2>
          <p className="text-sm text-slate-600">
            Live connection:{" "}
            <span
              className={`font-semibold ${
                liveStatus === "connected"
                  ? "text-emerald-600"
                  : liveStatus === "connecting"
                  ? "text-amber-500"
                  : "text-rose-600"
              }`}
            >
              {streamAvailable ? liveStatus : "disabled"}
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}
