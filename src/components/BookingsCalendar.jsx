// src/components/BookingsCalendar.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import {
  CalendarRange,
  RefreshCcw,
  Download as DownloadIcon,
  Eye,
  XCircle,
  Ticket,
} from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const DangerBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* -------------------------------- Component -------------------------------- */
export default function BookingsCalendar({ movieId }) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const todayDefault = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(todayDefault);
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 13); // 14-day window
    return d.toISOString().slice(0, 10);
  });

  const [eventsByDay, setEventsByDay] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyCancelId, setBusyCancelId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetchCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, from, to, token]);

  async function fetchCalendar() {
    try {
      setLoading(true);
      setError("");
      setMsg("");
      const res = await api.get("/bookings/calendar", {
        params: { movieId, from, to },
        headers: { Authorization: `Bearer ${token}` },
      });
      setEventsByDay(res.data?.eventsByDay || {});
    } catch (e) {
      console.error("Failed to fetch bookings calendar", e);
      setError("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const days = useMemo(() => Object.keys(eventsByDay).sort(), [eventsByDay]);

  const buildTicketUrl = (bookingId) => {
    const base =
      (api?.defaults?.baseURL || import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
    const root = base.replace(/\/api$/i, ""); // support setups where baseURL ends with /api
    return `${root}/bookings/${bookingId}/ticket`;
  };

  const downloadTicket = async (bookingId) => {
    try {
      const url = buildTicketUrl(bookingId);
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || `Status ${resp.status}`);
      }
      const blob = await resp.blob();
      const fileUrl = URL.createObjectURL(blob);
      window.open(fileUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (err) {
      console.error("Download ticket error", err);
      setMsg(err.message || "Failed to download ticket");
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      setBusyCancelId(bookingId);
      await api.patch(`/bookings/${bookingId}/cancel`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Booking cancelled. Check your email/SMS for refund details.");
      fetchCalendar();
    } catch (err) {
      console.error("Cancel failed", err);
      setMsg(err?.response?.data?.message || "Failed to cancel booking");
    } finally {
      setBusyCancelId(null);
    }
  };

  const fmtSeat = (s) => {
    if (!s) return "";
    if (typeof s === "string") return s;
    if (s.label) return s.label;
    const r = s.row ?? "";
    const c = s.col ?? s.column ?? "";
    return `${r}${r && c ? "-" : ""}${c}`;
  };

  if (!token) return <div className="text-center py-6">Please log in to view your bookings.</div>;
  if (loading) return <Loader text="Loading bookings..." />;

  return (
    <div className="space-y-4">
      {/* Header / Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-slate-800">
            <CalendarRange className="h-5 w-5 text-[#0654BA]" />
            <span className="font-extrabold">Bookings Calendar</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
              />
            </label>
            <GhostBtn onClick={fetchCalendar}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </GhostBtn>
          </div>
        </div>
      </Card>

      {/* Messages */}
      {msg && (
        <Card className="p-3 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
          {msg}
        </Card>
      )}
      {error && (
        <Card className="p-3 border-rose-200 bg-rose-50 text-rose-700 font-semibold flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          {error}
        </Card>
      )}

      {/* Days grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {days.length === 0 ? (
          <Card className="col-span-3 p-6 text-center text-slate-600">
            No bookings in this range.
          </Card>
        ) : (
          days.map((day) => {
            const events = [...(eventsByDay[day] || [])].sort(
              (a, b) =>
                new Date(a.showtime?.time || a.showtime?.startsAt || a.createdAt || 0) -
                new Date(b.showtime?.time || b.showtime?.startsAt || b.createdAt || 0)
            );

            return (
              <Card key={day} className="p-3">
                <div className="font-extrabold text-slate-900 mb-2">
                  {new Date(day).toLocaleDateString()}
                </div>

                {events.map((b) => {
                  const show = b.showtime || {};
                  const timeRaw = show.time || show.startsAt || show.startTime || b.createdAt;
                  const time = timeRaw ? new Date(timeRaw) : null;
                  const timeLabel =
                    time && !isNaN(time.getTime())
                      ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "N/A";

                  const movieTitle = show.movie?.title || show.movieTitle || "Unknown Movie";
                  const screenName = show.screen?.name || show.screen || "Screen";
                  const seats =
                    Array.isArray(b.seats) && b.seats.length
                      ? b.seats.map(fmtSeat).filter(Boolean).join(", ")
                      : "—";

                  const isCancelled = String(b.status).toUpperCase() === "CANCELLED";
                  const chipClass = isCancelled
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";

                  return (
                    <Card key={b._id} className="mt-2 p-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 truncate">
                            {movieTitle} — {timeLabel}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">{screenName}</div>
                          <div className="text-xs text-slate-700 mt-0.5">Seats: {seats}</div>
                          <span
                            className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${chipClass}`}
                          >
                            <Ticket className="h-3.5 w-3.5" />
                            {String(b.status || "UNKNOWN").toUpperCase()}
                          </span>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <PrimaryBtn onClick={() => navigate(`/bookings/${b._id}`)} className="px-3 py-1">
                            <Eye className="h-4 w-4" />
                            View
                          </PrimaryBtn>

                          <GhostBtn onClick={() => downloadTicket(b._id)} className="px-3 py-1">
                            <DownloadIcon className="h-4 w-4" />
                            Download
                          </GhostBtn>

                          {String(b.status).toUpperCase() === "CONFIRMED" && (
                            <DangerBtn
                              disabled={busyCancelId === b._id}
                              onClick={() => cancelBooking(b._id)}
                              className="px-3 py-1"
                            >
                              {busyCancelId === b._id ? "Cancelling..." : "Cancel"}
                            </DangerBtn>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
