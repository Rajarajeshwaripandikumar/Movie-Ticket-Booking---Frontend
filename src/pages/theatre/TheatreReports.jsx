// src/pages/theatre/TheatreReports.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
// removed: import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/**
 * TheatreReports.jsx (date-fns removed)
 * - Place at: src/pages/theatre/TheatreReports.jsx
 * - Adjust API endpoints: GET /api/theatres/:id/reports
 * - Requires `recharts` installed for chart
 */

/* Small local date formatters to replace date-fns usages */
function fmtDateShort(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    // e.g. "04 Apr"
    return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  } catch {
    return String(d);
  }
}
function fmtDateLong(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    // e.g. "4 Apr 2025"
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

export default function TheatreReports() {
  const { id } = useParams();

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

  const csvRef = useRef(null);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/theatres/${id}/reports?start=${startDate}&end=${endDate}`);
        if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
        const data = await res.json();
        setReports(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [id, startDate, endDate]);

  const summary = reports?.summary || { revenue: 0, ticketsSold: 0, avgPrice: 0 };
  const salesByDay = reports?.salesByDay || [];
  const bookings = reports?.bookings || [];

  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => (
      String(b.id).toLowerCase().includes(q) ||
      (b.customerName || "").toLowerCase().includes(q) ||
      (Array.isArray(b.seats) ? b.seats.join(" ") : (b.seats || "")).toLowerCase().includes(q) ||
      (b.showTitle || "").toLowerCase().includes(q)
    ));
  }, [bookings, query]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const pageItems = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  function setRangeDays(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    const formatYMD = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setStartDate(formatYMD(start));
    setEndDate(formatYMD(end));
    setPage(1);
  }

  function downloadCSV() {
    const rows = [
      ["Booking ID", "Customer", "Show", "Time", "Seats", "Quantity", "Total (INR)", "Created At"]
    ];
    for (const b of filteredBookings) {
      rows.push([
        b.id,
        b.customerName || "",
        b.showTitle || "",
        b.showTime || "",
        Array.isArray(b.seats) ? b.seats.join("|") : (b.seats || ""),
        b.quantity || "",
        b.total || "",
        b.createdAt ? new Date(b.createdAt).toISOString() : ""
      ]);
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theatre_${id}_bookings_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-28 bg-gray-200 rounded"></div>
            <div className="h-28 bg-gray-200 rounded"></div>
            <div className="h-28 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold text-red-600">Failed to load reports</h2>
          <p className="mt-2 text-sm text-gray-700">{error}</p>
          <div className="mt-4">
            <Link to="/" className="px-4 py-2 rounded bg-blue-600 text-white">Back home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Theatre Reports</h1>
            <p className="text-sm text-gray-600 mt-1">{reports?.theatreName || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRangeDays(7)} className="px-3 py-2 rounded-lg bg-white border">Last 7d</button>
            <button onClick={() => setRangeDays(30)} className="px-3 py-2 rounded-lg bg-white border">Last 30d</button>
            <button onClick={() => setRangeDays(90)} className="px-3 py-2 rounded-lg bg-white border">Last 90d</button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="text-xs text-gray-500">Revenue</div>
            <div className="text-2xl font-semibold mt-1">₹{Number(summary.revenue || 0).toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-2">Period: {startDate} → {endDate}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="text-xs text-gray-500">Tickets sold</div>
            <div className="text-2xl font-semibold mt-1">{Number(summary.ticketsSold || 0).toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-2">Avg price: ₹{Number(summary.avgPrice || 0).toFixed(2)}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-500">Conversion</div>
                <div className="text-2xl font-semibold mt-1">{reports?.conversionRate ? (reports.conversionRate * 100).toFixed(1) + "%" : "—"}</div>
              </div>
              <div>
                <button onClick={downloadCSV} className="px-3 py-2 rounded bg-yellow-400 text-black">Export CSV</button>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">Bookings: {bookings.length}</div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Sales by day</h3>
              <div className="text-xs text-gray-500">{startDate} → {endDate}</div>
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

          <div className="bg-white p-4 rounded-2xl shadow">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Bookings</h3>
              <div className="flex items-center gap-2">
                <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search bookings..." className="px-3 py-2 border rounded-lg text-sm" />
                <div className="text-xs text-gray-500">{filteredBookings.length} results</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
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
                    {pageItems.map(b => (
                      <tr key={b.id} className="border-b">
                        <td className="py-2 text-xs text-gray-700">{b.id}</td>
                        <td className="py-2">{b.customerName || "—"}</td>
                        <td className="py-2">{b.showTitle || "—"}</td>
                        <td className="py-2 text-xs">{Array.isArray(b.seats) ? b.seats.join(", ") : b.seats}</td>
                        <td className="py-2">{b.quantity}</td>
                        <td className="py-2">₹{b.total}</td>
                        <td className="py-2 text-xs text-gray-500">{b.createdAt ? fmtDateLong(b.createdAt) : "—"}</td>
                      </tr>
                    ))}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-sm text-gray-500">No bookings found for this range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">Page {page} / {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded border">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded border">Next</button>
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
