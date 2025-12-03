// src/pages/AdminBookingDetails.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api, { getAuthFromStorage } from "../api/api";
import { User, IndianRupee, Film, ArrowLeft, Download } from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
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

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Chip({ children, className = "", ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Helpers -------------------------------- */
function resolvePoster(bk) {
  // prefer booking.movie, then showtime.movie
  const m = bk?.movie || bk?.showtime?.movie || {};
  let src =
    m?.posterUrl ||
    m?.poster ||
    bk?.movie?.posterUrl ||
    bk?.movie?.poster ||
    bk?.showtime?.movie?.posterUrl ||
    bk?.showtime?.movie?.poster;

  if (!src) return null;
  src = String(src).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(src)) return src;

  const path = src.startsWith("/uploads/")
    ? src
    : src.startsWith("/")
    ? src
    : `/uploads/${src}`;

  const base = (
    api?.defaults?.baseURL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/+$/, "");

  // api.defaults.baseURL is e.g. http://localhost:8080/api — remove trailing '/api' if present
  const root = base.replace(/\/api$/i, "");
  return `${root}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

/* --------------------------- AdminBookingDetails -------------------------- */
export default function AdminBookingDetails() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const shortId = useMemo(
    () => (id ? String(id).slice(-6).toUpperCase() : "—"),
    [id]
  );

  /* Fetch booking */
  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // api baseURL already contains "/api", so call paths WITHOUT leading "/api"
        const res = await api.get(`/bookings/${id}`, { signal: ac.signal });
        // backend returns { ok, booking }
        setBooking(res.data?.booking || res.data);

        const nid = search.get("notificationId");
        if (nid) {
          try {
            // Best-effort: mark notification read (ignore failures)
            await api.patch(`/notifications/${nid}/read`);
          } catch {
            /* ignore notification patch failure */
          }
        }
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Fetch booking failed:", err);
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err.message ||
            "Failed to load booking"
        );
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [id, search]);

  /* Loading & error states */
  if (loading)
    return (
      <main className="min-h-[60vh] w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 grid place-items-center px-6">
        <Card className="max-w-md w-full p-5 text-slate-900">
          Loading booking details…
        </Card>
      </main>
    );

  if (error)
    return (
      <main className="min-h-[60vh] w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 grid place-items-center px-6">
        <Card className="max-w-md w-full p-5 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
          {error}
        </Card>
      </main>
    );

  if (!booking)
    return (
      <main className="min-h-[60vh] w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 grid place-items-center px-6">
        <Card className="max-w-md w-full p-5 text-slate-900">
          Booking not found.
        </Card>
      </main>
    );

  /* Data setup: match backend fields */
  const {
    _id,
    status,
    paymentStatus,
    showtime = {},
    seats = [],
    totalAmount,
    amount: amountMaybe,
    createdAt,
    customer = {},
    user = booking.user, // keep raw user (can be null)
    movie: movieRoot,
  } = booking;

  // movie from root (backend fix) or showtime
  const movie = movieRoot || showtime.movie || {};
  const posterUrl = resolvePoster({ movie, showtime });

  const seatList =
    Array.isArray(seats) && seats.length
      ? seats
          .map((s) =>
            typeof s === "string"
              ? s
              : s?.seatId ||
                s?.label ||
                [s.row, s.col].filter((v) => v != null).join("-")
          )
          .join(", ")
      : "—";

  const createdLabel =
    createdAt && !Number.isNaN(new Date(createdAt).getTime())
      ? new Date(createdAt).toLocaleString("en-IN")
      : "—";

  const effectiveAmount =
    totalAmount != null
      ? totalAmount
      : amountMaybe != null
      ? amountMaybe
      : 0;
  const amountLabel = Number.isFinite(Number(effectiveAmount))
    ? `₹${Number(effectiveAmount).toFixed(2)}`
    : "—";

  const rawStatus = (status || paymentStatus || "UNKNOWN").toUpperCase();
  const isBad = ["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(
    rawStatus
  );

  // Build PDF URL — use getAuthFromStorage() for token lookup (safe)
  const base = (
    api?.defaults?.baseURL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/+$/, "");
  const root = base.replace(/\/api$/i, "");
  const maybeAuth = getAuthFromStorage?.() || {};
  const token = (
    maybeAuth.token ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    ""
  ).replace(/^Bearer\s+/i, "");
  const pdfUrl = `${root}/api/bookings/${_id}/pdf${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;

  // detect "deleted user" case: backend populated user but found nothing
  const hasDeletedUser =
    Object.prototype.hasOwnProperty.call(booking, "user") &&
    booking.user === null;

  const customerName =
    customer?.name ||
    user?.name ||
    (hasDeletedUser ? "Deleted user" : "—");

  const customerEmail =
    customer?.email || user?.email || (hasDeletedUser ? "—" : "—");

  const customerPhone =
    customer?.phone || user?.phone || (hasDeletedUser ? "—" : "—");

  const customerId =
    (user && typeof user === "object" && user._id) ||
    customer?._id ||
    (hasDeletedUser ? "deleted" : "—");

  /* ------------------------------- Render ---------------------------------- */
  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8">
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-5">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <SecondaryBtn onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </SecondaryBtn>
          <Chip>Booking ID: #{String(_id || shortId).slice(-6)}</Chip>
        </div>

        {/* Main card */}
        <Card className="p-5">
          <div className="grid md:grid-cols-3 gap-5">
            {/* Poster */}
            <div className="md:col-span-1">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie?.title || "Poster"}
                  className="rounded-xl border border-slate-200 shadow-sm w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="h-72 w-full rounded-xl border border-slate-200 shadow-sm bg-slate-50 grid place-items-center text-slate-500">
                  No Image
                </div>
              )}
            </div>

            {/* Details */}
            <div className="md:col-span-2 space-y-5">
              {/* Movie & screen */}
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                  <Film size={22} className="text-[#0654BA]" />{" "}
                  {movie?.title || "Untitled"}
                </h2>
                <p className="text-sm text-slate-600">
                  Screen: {showtime?.screen?.name || "—"}
                </p>
              </div>

              {/* Seats */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-1">
                  Seats
                </div>
                <Card className="px-3 py-2 text-sm">{seatList}</Card>
              </div>

              {/* Payment Info */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <IndianRupee size={18} className="text-[#0654BA]" /> Payment
                  Info
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <InfoItem label="Amount" value={amountLabel} />
                  <StatusPill label="Status" value={rawStatus} bad={isBad} />
                  <InfoItem label="Created" value={createdLabel} />
                  <InfoItem
                    label="Tickets"
                    value={`${seats?.length || 0} ticket(s)`}
                  />
                </div>

                <div className="mt-3 flex gap-3">
                  <PrimaryBtn
                    onClick={() => {
                      try {
                        const a = document.createElement("a");
                        a.href = pdfUrl;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      } catch {
                        window.open(
                          pdfUrl,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }
                    }}
                  >
                    <Download size={16} /> Download Ticket
                  </PrimaryBtn>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <User size={18} className="text-[#0654BA]" /> Customer Info
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <InfoItem label="Name" value={customerName} />
                  <InfoItem label="Email" value={customerEmail} />
                  <InfoItem label="Phone" value={customerPhone} />
                  <InfoItem
                    label="User ID"
                    value={
                      customerId ? (
                        <code className="text-xs">{customerId}</code>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Raw JSON Debug */}
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold underline decoration-2 decoration-[#0071DC] underline-offset-4">
            Raw Booking JSON
          </summary>
          <Card className="mt-2 p-3">
            <pre className="overflow-x-auto text-xs">
              {(() => {
                try {
                  return JSON.stringify(booking, null, 2);
                } catch {
                  return "[unserializable booking object]";
                }
              })()}
            </pre>
          </Card>
        </details>
      </div>
    </main>
  );
}

/* ------------------------------ Small bits ------------------------------ */
function InfoItem({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-slate-900 font-medium">{value}</div>
    </div>
  );
}
function StatusPill({ label, value, bad }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-slate-600">{label}</div>
      <span
        className={`px-2 py-0.5 text-xs font-bold rounded-full border ${
          bad
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
