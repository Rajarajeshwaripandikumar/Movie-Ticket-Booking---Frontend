// src/pages/MyBookings.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function LinkBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------- UI helpers ----------------------------- */
const Pill = ({ children, className = "" }) => (
  <span className={`inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 ${className}`}>
    {children}
  </span>
);

const badgeMap = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  REFUNDED: "bg-sky-50 text-sky-700 ring-sky-200",
  DEFAULT: "bg-slate-50 text-slate-700 ring-slate-200",
};
const Badge = ({ status = "DEFAULT" }) => {
  const cls = badgeMap[status] || badgeMap.DEFAULT;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
};

function Money({ value }) {
  const n = Number(value ?? 0);
  return <span>₹{n.toLocaleString("en-IN")}</span>;
}

/* ----------------------- Seat formatting helper ----------------------- */
/* (unchanged logic — kept as-is) */
const formatSeats = (rawInput, { seatsPerRow = 10, rows = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" } = {}) => {
  if (rawInput == null) return "—";
  const input = Array.isArray(rawInput) ? rawInput : [rawInput];

  const expandToken = (token) => {
    if (token == null) return [];
    if (typeof token === "object" && !Array.isArray(token)) {
      if ("row" in token && "col" in token) {
        return [`${String(token.row).toUpperCase()}-${token.col}`];
      }
      return [];
    }
    if (typeof token === "number" && Number.isFinite(token)) {
      return [token];
    }
    if (typeof token === "string") {
      const s = token.trim();
      if (/^[A-Za-z]+\s*[-_\s]?\s*\d+$/.test(s) || /^[A-Za-z]+\d+$/.test(s)) {
        const parts = s.split(/[-_\s]+/).filter(Boolean);
        if (parts.length >= 2) return [`${parts[0].toUpperCase()}-${parts[1]}`];
        return [s.toUpperCase()];
      }
      if (/^\d+\s*-\s*\d+$/.test(s)) {
        const [a, b] = s.split("-").map((x) => parseInt(x.trim(), 10)).sort((x, y) => x - y);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const out = [];
          for (let v = a; v <= b; v++) out.push(v);
          return out;
        }
      }
      if (s.includes(",")) {
        return s.split(",").map((p) => p.trim()).flatMap(expandToken);
      }
      if (/^\d+$/.test(s)) return [Number(s)];
      return [s];
    }
    return [];
  };

  const flat = input.flatMap(expandToken).filter((x) => x != null);

  const mapped = flat.map((item) => {
    if (typeof item === "number") {
      const idx = item - 1;
      const rowIndex = Math.floor(idx / seatsPerRow);
      const rowLetter = rows[rowIndex] ?? `R${rowIndex + 1}`;
      const colNumber = (idx % seatsPerRow) + 1;
      return `${rowLetter}-${colNumber}`;
    }
    if (typeof item === "string" && /^[A-Za-z]+-\d+$/.test(item)) {
      const parts = item.split("-");
      return `${parts[0].toUpperCase()}-${parts[1]}`;
    }
    return String(item);
  });

  const unique = Array.from(new Set(mapped));
  unique.sort((a, b) => {
    const [ra, ca] = a.split("-");
    const [rb, cb] = b.split("-");
    if (ra === rb) {
      const na = parseInt(ca || "0", 10) || 0;
      const nb = parseInt(cb || "0", 10) || 0;
      return na - nb;
    }
    return (ra || "").localeCompare(rb || "");
  });

  if (unique.length === 0) return "—";
  return unique.join(", ");
};
/* --------------------- end seat formatting helper -------------------- */

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [cancellingId, setCancellingId] = useState(null);
  // Use auth only for optional UI behaviors; api will attach token itself
  const auth = useAuth();
  const navigate = useNavigate();

  const loadBookings = async () => {
    setLoading(true);
    setMsg("");
    try {
      // Backend: { ok: true, bookings: [...] }
      const res = await api.get("/bookings/me");
      const data = res?.data ?? {};

      if (data.ok === false) {
        setMsg(data.error || "❌ Failed to load bookings.");
        setMsgType("error");
        setBookings([]);
        return;
      }

      const list = Array.isArray(data.bookings)
        ? data.bookings
        : Array.isArray(data)
        ? data
        : [];

      setBookings(list);
    } catch (e) {
      console.error("Error fetching bookings", e);
      const status = e?.response?.status;
      if (status === 401) {
        setMsg("You must be logged in to view bookings.");
      } else {
        const serverMsg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          (typeof e?.response?.data === "string" ? e.response.data : null);
        setMsg(serverMsg || "❌ Failed to load bookings.");
      }
      setMsgType("error");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelBooking = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      setCancellingId(id);
      setMsg("");
      const res = await api.patch(`/bookings/${id}/cancel`, {});
      const successMsg = res?.data?.message || "✅ Booking cancelled successfully.";
      setMsg(successMsg);
      setMsgType("success");
      await loadBookings();
    } catch (e) {
      console.error("Cancel error", e);
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        (typeof e?.response?.data === "string" ? e.response.data : null);
      setMsg(serverMsg || "❌ Cancel failed.");
      setMsgType("error");
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <Loader text="Loading your bookings..." />;

  return (
    <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-3 sm:px-4 md:px-6 lg:px-8">
      <header className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Bookings</h1>
        <p className="text-slate-600 mt-2">View your tickets, payment status, and manage cancellations.</p>
      </header>

      {msg && (
        <Card
          className={`mb-6 p-3 font-semibold ${
            msgType === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : msgType === "error"
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {msg}
        </Card>
      )}

      {bookings.length === 0 ? (
        <div className="flex justify-center">
          <Card className="w-full max-w-xl p-8 text-center">
            <div className="text-5xl mb-2">🍿</div>
            <h2 className="text-xl font-extrabold mb-1">No Bookings Found</h2>
            <p className="text-slate-600 mb-4">You haven’t booked any tickets yet.</p>

            <Link
              to="/movies"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA]"
            >
              Browse Movies
            </Link>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 max-w-5xl mx-auto">
          {bookings.map((b) => {
            const show = b.showtime || {};
            const movieTitle = show.movie?.title || b.movie?.title || "Unknown Movie";
            const theater = show.screen?.name || "—";

            const seats = formatSeats(b.seats, {
              seatsPerRow: show?.screen?.cols || 10,
            });

            const date = show.startTime || show.time || show.date || null;
            const dateStr = date
              ? new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
              : "—";
            const isCancelling = cancellingId === b._id;
            const amount = b.totalAmount ?? b.amount; // backend uses totalAmount

            return (
              <Card key={b._id} className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <button
                    className="flex-1 text-left"
                    onClick={() => navigate(`/bookings/${b._id}`)}
                    aria-label={`Open ticket for ${movieTitle}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-extrabold leading-none">{movieTitle}</h2>
                      <Pill>{theater}</Pill>
                      <Pill>
                        <Money value={amount} />
                      </Pill>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      <span className="font-semibold">Seats:</span> {seats}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Showtime: {dateStr}</p>
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    <Badge status={b.status} />

                    <div className="flex gap-2">
                      <Link
                        to={`/bookings/${b._id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50"
                      >
                        View Ticket
                      </Link>

                      {b.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(b._id)}
                          disabled={isCancelling}
                          className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border ${
                            isCancelling
                              ? "border-rose-200 bg-rose-200 text-rose-800 cursor-wait"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          {isCancelling ? "Cancelling..." : "Cancel"}
                        </button>
                      )}
                    </div>

                    {b.status === "CANCELLED" && (
                      <p className="text-xs text-slate-600">
                        Refund {b.refundId ? "processed" : "pending"}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
