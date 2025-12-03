// frontend/src/pages/theatre/TheatreReports.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Ticket,
  Users,
  Download,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { useAuth } from "../../context/AuthContext";
import api, { extractApiError } from "../../api/api";

/* ======================== Styling primitives ======================== */
const BLUE = "#0071DC";
const SOFT = "#94A3B8";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const Pill = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const Primary = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    style={{ backgroundColor: BLUE }}
  >
    {children}
  </button>
);

const ranges = [
  { id: "7d", label: "Last 7d", days: 7 },
  { id: "30d", label: "Last 30d", days: 30 },
  { id: "90d", label: "Last 90d", days: 90 },
];

/* ======================== Helpers & formatters ======================== */
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

const toSalesByDay = (arr = []) =>
  (arr || []).map((d, i) => {
    const iso =
      d._id ||
      d.dayISO ||
      d.date?.slice?.(0, 10) ||
      d.day ||
      `D${i + 1}`;
    const revenue = Number(d.revenue ?? d.totalRevenue ?? d.total ?? 0);
    const bookings = Number(d.bookings ?? d.totalBookings ?? 0);
    const tickets = Number(d.tickets ?? d.totalTickets ?? 0);

    return {
      dayISO: iso,
      day: fmtDay(iso),
      revenue,
      bookings,
      tickets,
    };
  });

/* ======================== Main component ======================== */
export default function TheatreReports() {
  const { user, loading: authLoading } = useAuth();

  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTickets: 0,
    totalBookings: 0,
  });
  const [salesByDay, setSalesByDay] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");

  const lastRequestRef = useRef({ start: "", end: "" });

  const daysOf = (id) => ranges.find((r) => r.id === id)?.days ?? 30;

  // Ensure axios auth header (similar to AdminAnalytics)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
      if (raw) {
        const a = JSON.parse(raw);
        if (a?.token) api.setAuthToken(a.token);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial load after auth ready
  useEffect(() => {
    if (authLoading || !user) return;
    const c = new AbortController();
    loadData(range, 1, c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Reload on range change
  useEffect(() => {
    if (authLoading || !user) return;
    loadData(range, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function loadData(selectedRange, page = 1, signal) {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const days = daysOf(selectedRange);
      const today = new Date();
      const endISO = today.toISOString().slice(0, 10);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (days - 1));
      const startISO = startDate.toISOString().slice(0, 10);

      lastRequestRef.current = { start: startISO, end: endISO };

      const res = await api.get("/theatre/reports", {
        params: {
          start: startISO,
          end: endISO,
          page,
          limit: 10,
        },
        signal,
      });

      const data = res.data || {};

      const s = data.stats || {};
      setStats({
        totalRevenue: Number(s.totalRevenue ?? 0),
        totalTickets: Number(s.totalTickets ?? 0),
        totalBookings: Number(s.totalBookings ?? 0),
      });

      setSalesByDay(toSalesByDay(data.byDay || []));
      setBookings(Array.isArray(data.bookings) ? data.bookings : []);

      const pag = data.bookingsPagination || {};
      setPagination({
        page: Number(pag.page ?? page),
        limit: Number(pag.limit ?? 10),
        total: Number(pag.total ?? (data.stats?.totalBookings ?? 0)),
        totalPages: Number(pag.totalPages ?? 1),
      });
    } catch (e) {
      if (e?.name === "AbortError" || e?.code === "ERR_CANCELED") return;
      console.error("Theatre reports load failed:", e);
      setError(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }

  function handlePageChange(nextPage) {
    if (
      nextPage < 1 ||
      nextPage > (pagination.totalPages || 1) ||
      loading ||
      authLoading
    )
      return;
    loadData(range, nextPage);
  }

  /* ============ CSV Export ============ */
  function exportCSV() {
  const { start, end } = lastRequestRef.current || {};
  const header = [
    "BookingID",
    "Customer",
    "Seats",  // Removed Show
    "Qty",
    "Total",
    "CreatedAt",
  ];

  const csvEscape = (v) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = bookings.map((b) => {
    const customer = b.user?.name || b.user?.email || "—";
    const qty = Number(b.seatCount ?? b.seats?.length ?? 0);
    const created = b.createdAt ? new Date(b.createdAt).toISOString() : "";
    const seats = qty ? `Seat x${qty}` : "";  // Instead of show, using seats

    return [
      b._id,
      customer,
      seats, // Replaced Show with Seats
      qty,
      b.totalAmount ?? 0,
      created,
    ];
  });

  let csv = `Theatre Bookings (${start} → ${end})\n`;
  csv += header.join(",") + "\n";
  csv += rows.map((r) => r.map(csvEscape).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `theatre_reports_${start || "start"}_${end || "end"}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}


  /* ============ Derived bookings for search ============ */
  const filteredBookings = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const id = String(b._id || "").toLowerCase();
    const customer = (b.user?.name || b.user?.email || "").toLowerCase();
    const title =
      (
        b.showtime?.movieTitle ||
        b.showtime?.movieName ||
        b.showtime?.movie?.title ||
        ""
      ).toLowerCase();

    return (
      id.includes(q) || customer.includes(q) || title.includes(q)
    );
  });

  /* ============ Render ============ */
  const daysLabel = ranges.find((r) => r.id === range)?.label || "";

  return (
    <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Theatre Reports
          </h1>
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-slate-600">
                View bookings and revenue for your theatre. Range:{" "}
                <span className="font-semibold">{daysLabel}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Primary
                  onClick={exportCSV}
                  disabled={!bookings.length || loading}
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Primary>
                <Pill
                  onClick={() => loadData(range, pagination.page)}
                  disabled={authLoading || !user || loading}
                >
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </Pill>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-full p-1">
                  {ranges.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition ${
                        range === r.id
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
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

        {error && (
          <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
            {error}
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          <Stat
            icon={CircleDollarSign}
            label={`Revenue (${daysLabel})`}
            value={formatCurrency(stats.totalRevenue)}
          />
          <Stat
            icon={Ticket}
            label="Tickets sold"
            value={formatInt(stats.totalTickets)}
            helper={
              stats.totalTickets
                ? `Avg price: ${formatCurrency(
                    stats.totalRevenue / stats.totalTickets
                  )}`
                : "—"
            }
          />
          <Stat
            icon={BarChart3}
            label="Bookings"
            value={formatInt(stats.totalBookings)}
            helper="Total confirmed bookings in range"
          />
        </div>

        {/* Sales chart + Bookings table */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Chart */}
          <div className="lg:col-span-3">
            <Card className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-600">
                    Sales by day ({daysLabel})
                  </p>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Daily Revenue
                  </h3>
                </div>
              </div>

              <div className="h-64">
                {loading && !salesByDay.length ? (
                  <EmptyMini label="Loading sales..." />
                ) : salesByDay && salesByDay.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByDay}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={SOFT}
                        opacity={0.45}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: SOFT }}
                        stroke={SOFT}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: SOFT }}
                        stroke={SOFT}
                        domain={["dataMin", "auto"]}
                      />
                      <Tooltip
                        formatter={(v, k) =>
                          k === "revenue" ? formatCurrency(v) : formatInt(v)
                        }
                      />
                      <Bar dataKey="revenue" fill={BLUE} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyMini label="No bookings in this period." />
                )}
              </div>
            </Card>
          </div>

  <div className="lg:col-span-2">
  <Card className="p-4 h-full flex flex-col">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <p className="text-xs text-slate-600">Bookings</p>
        <h3 className="text-lg font-extrabold text-slate-900">
          Recent bookings
        </h3>
      </div>
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bookings..."
          className="pl-8 pr-2 py-1.5 rounded-full border text-xs text-slate-700 placeholder:text-slate-400"
        />
      </div>
    </div>

    <div className="flex-1 overflow-auto">
      {loading && !bookings.length ? (
        <EmptyMini label="Loading bookings..." />
      ) : filteredBookings && filteredBookings.length ? (
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-slate-600 border-b border-slate-200">
              <th className="py-2 pr-2">ID</th>
              <th className="py-2 pr-2">Customer</th>
              {/* removed Show column */}
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Total</th>
              <th className="py-2 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((b) => {
              const customer = b.user?.name || b.user?.email || "—";
              const qty = Number(b.seatCount ?? b.seats?.length ?? 0);
              const createdLabel = b.createdAt
                ? fmtDay(String(b.createdAt).slice(0, 10))
                : "—";
              return (
                <tr
                  key={b._id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2 pr-2 max-w-[120px] truncate text-slate-500">
                    {String(b._id).slice(-6)}
                  </td>
                  <td className="py-2 pr-2">{customer}</td>
                  {/* removed Show cell */}
                  <td className="py-2 pr-2 text-right">
                    {formatInt(qty)}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {formatCurrency(b.totalAmount ?? 0)}
                  </td>
                  <td className="py-2 pr-2">{createdLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <EmptyMini label="No bookings in this period." />
      )}
    </div>

              {/* Pagination */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                <div>
                  {pagination.total > 0 ? (
                    <span>
                      Page {pagination.page} of {pagination.totalPages} ·{" "}
                      {formatInt(pagination.total)} bookings
                    </span>
                  ) : (
                    <span>No bookings</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill
                    onClick={() =>
                      handlePageChange(pagination.page - 1)
                    }
                    disabled={pagination.page <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Pill>
                  <Pill
                    onClick={() =>
                      handlePageChange(pagination.page + 1)
                    }
                    disabled={
                      pagination.page >= pagination.totalPages || loading
                    }
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Pill>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== Subcomponents ======================== */
function Stat({ icon: Icon, label, value, helper }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
            <Icon className="h-5 w-5 text-slate-900" />
          </span>
          <div>
            <p className="text-xs text-slate-600">{label}</p>
            <p className="text-xl font-extrabold text-slate-900">
              {value}
            </p>
            {helper && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {helper}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

const EmptyMini = ({ label }) => (
  <div className="h-full w-full grid place-items-center text-center text-sm text-slate-600">
    <div>
      <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-70" />
      <p>{label}</p>
    </div>
  </div>
);
