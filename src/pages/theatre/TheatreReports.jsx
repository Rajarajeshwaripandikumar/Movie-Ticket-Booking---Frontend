// src/pages/theatre/TheatreReports.jsx — polished (District / Walmart style)
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* --- local date formatters (no date-fns) --- */
function fmtDateShort(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  } catch {
    return String(d);
  }
}
function fmtDateLong(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

/* --- helpers --- */
const A = (x) =>
  Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : [];

function decodeJwt(t) {
  try {
    return JSON.parse(atob(String(t ?? "").split(".")[1])) || {};
  } catch {
    return {};
  }
}

async function tryGet(endpoints = []) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const res = await api.get(ep);
      return res?.data ?? res;
    } catch {
      // continue
    }
  }
  return undefined;
}

/* ------------------------------ Component ------------------------------ */
export default function TheatreReports() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null;
  const payload = decodeJwt(activeToken);

  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?._id ||
    user?.theatre?.id ||
    user?.theater?._id ||
    user?.theater?.id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const mountedRef = useRef(true);

  useEffect(() => {
    document.title = "Theatre Reports | Cinema";
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadReports = useCallback(async () => {
    if (!activeToken || !isTheatreAdmin || !theatreId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const q = `start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      const base = theatreId ? `theatre=${encodeURIComponent(theatreId)}&` : "";

      const data =
        (await tryGet([
          `/theatre/reports?${base}${q}`,
          `/admin/reports?${base}${q}`,
          `/reports?${base}${q}`,
        ])) || {};

      if (!mountedRef.current) return;
      setReports(data);
      setPage(1);
    } catch (err) {
      console.error("Reports load error", err?.response || err);
      if (!mountedRef.current) return;
      setReports(null);
      setError(err?.response?.data?.message || err?.message || "Failed to load reports");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeToken, isTheatreAdmin, theatreId, startDate, endDate]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const summary = reports?.summary || { revenue: 0, ticketsSold: 0, avgPrice: 0 };
  const salesByDay = reports?.salesByDay || [];
  const bookings = A(reports?.bookings || []);

  const filteredBookings = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      const seatsStr = Array.isArray(b.seats) ? b.seats.join(" ") : b.seats || "";
      return (
        String(b.id ?? b._id ?? "")
          .toLowerCase()
          .includes(q) ||
        (b.customerName || "").toLowerCase().includes(q) ||
        seatsStr.toLowerCase().includes(q) ||
        (b.showTitle || "").toLowerCase().includes(q)
      );
    });
  }, [bookings, query]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  function setRangeDays(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    const toYMD = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    setStartDate(toYMD(start));
    setEndDate(toYMD(end));
  }

  function sanitizeFilename(name) {
    return String(name || "theatre").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
  }

  function downloadCSV() {
    const rows = [
      ["Booking ID", "Customer", "Show", "Time", "Seats", "Quantity", "Total (INR)", "Created At"],
    ];
    for (const b of filteredBookings) {
      rows.push([
        b.id ?? b._id ?? "",
        b.customerName || "",
        b.showTitle || "",
        b.showTime || "",
        Array.isArray(b.seats) ? b.seats.join("|") : b.seats || "",
        b.quantity ?? "",
        b.total ?? "",
        b.createdAt ? new Date(b.createdAt).toISOString() : "",
      ]);
    }
    const csv =
      "\uFEFF" + // BOM for Excel UTF-8
      rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const namePart = sanitizeFilename(reports?.theatreName || theatreId || "theatre");
    a.download = `${namePart}_bookings_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div role="status" aria-live="polite" className="animate-pulse h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-28 bg-gray-200 rounded" />
            <div className="h-28 bg-gray-200 rounded" />
            <div className="h-28 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-semibold text-rose-600">Failed to load reports</h2>
          <p className="mt-2 text-sm text-slate-700">{error}</p>
          <div className="mt-4">
            <Link to="/" className="px-4 py-2 rounded-full bg-[#0071DC] text-white hover:bg-[#0654BA]">
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111827]">Theatre Reports</h1>
            <p className="text-sm text-slate-600 mt-1">{reports?.theatreName || "—"}</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setRangeDays(7)} className="px-3 py-2 rounded-lg bg-white border">
              Last 7d
            </button>
            <button onClick={() => setRangeDays(30)} className="px-3 py-2 rounded-lg bg-white border">
              Last 30d
            </button>
            <button onClick={() => setRangeDays(90)} className="px-3 py-2 rounded-lg bg-white border">
              Last 90d
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-[11px] text-slate-500">Revenue</div>
            <div className="text-2xl font-bold mt-1">₹{Number(summary.revenue || 0).toLocaleString()}</div>
            <div className="text-sm text-slate-500 mt-2">
              Period: {startDate} → {endDate}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-[11px] text-slate-500">Tickets sold</div>
            <div className="text-2xl font-bold mt-1">{Number(summary.ticketsSold || 0).toLocaleString()}</div>
            <div className="text-sm text-slate-500 mt-2">Avg price: ₹{Number(summary.avgPrice || 0).toFixed(2)}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] text-slate-500">Conversion</div>
                <div className="text-2xl font-bold mt-1">
                  {reports?.conversionRate ? (reports.conversionRate * 100).toFixed(1) + "%" : "—"}
                </div>
              </div>
              <div>
                <button onClick={downloadCSV} className="px-3 py-2 rounded-full bg-[#FFC220] text-black">
                  Export CSV
                </button>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">Bookings: {bookings.length}</div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sales by day</h3>
              <div className="text-xs text-slate-500">
                {startDate} → {endDate}
              </div>
            </div>

            <div style={{ height: 260 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDateShort(d)} />
                  <YAxis />
                  <Tooltip labelFormatter={(d) => fmtDateLong(d)} />
                  <Bar dataKey="tickets" name="Tickets" />
                  <Bar dataKey="revenue" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bookings</h3>
              <div className="flex items-center gap-2">
                <label htmlFor="booking-search" className="sr-only">Search bookings</label>
                <input
                  id="booking-search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search bookings..."
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <div className="text-xs text-slate-500">{filteredBookings.length} results</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2">ID</th>
                      <th className="py-2">Customer</th>
                      <th className="py-2">Show</th>
                      <th className="py-2">Seats</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((b) => (
                      <tr key={b.id ?? b._id} className="border-b">
                        <td className="py-2 text-xs text-slate-700">{b.id ?? b._id}</td>
                        <td className="py-2">{b.customerName || "—"}</td>
                        <td className="py-2">{b.showTitle || "—"}</td>
                        <td className="py-2 text-xs">{Array.isArray(b.seats) ? b.seats.join(", ") : b.seats}</td>
                        <td className="py-2">{b.quantity ?? "—"}</td>
                        <td className="py-2">₹{b.total ?? "—"}</td>
                        <td className="py-2 text-xs text-slate-500">{b.createdAt ? fmtDateLong(b.createdAt) : "—"}</td>
                      </tr>
                    ))}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-sm text-slate-500">
                          No bookings found for this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Page {page} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded border">
                    Prev
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded border">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
