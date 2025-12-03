// src/pages/TicketDetails.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import { QRCodeCanvas } from "qrcode.react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = React.forwardRef(function Card(
  { children, className = "", as: Tag = "div", ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});

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

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Helpers / seat utils                         */
/* -------------------------------------------------------------------------- */

// convert "1:9" / "R7C10" to labels like A-9 / G-10 for display
function seatIdToLabel(seatId) {
  if (!seatId) return null;
  const id = String(seatId).trim();
  const ROWS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // "row:col"  -> "A-9"
  let m = id.match(/^(\d+):(\d+)$/);
  if (m) {
    const row = parseInt(m[1], 10);
    const col = parseInt(m[2], 10);
    const rowLetter = ROWS[row - 1] ?? `R${row}`;
    return `${rowLetter}-${col}`;
  }

  // "R7C10" -> "G-10"
  m = id.match(/^R(\d+)C(\d+)$/i);
  if (m) {
    const row = parseInt(m[1], 10);
    const col = parseInt(m[2], 10);
    const rowLetter = ROWS[row - 1] ?? `R${row}`;
    return `${rowLetter}-${col}`;
  }

  // fallback – let normalizeSeatLabel clean up if needed
  return id;
}

// normalize labels like "h9" / "H-9" → "H-9"
const normalizeSeatLabel = (label) => {
  if (!label && label !== 0) return label;
  const s = String(label).trim();
  const m = s.match(/^([A-Za-z]+)(\d+)$/); // H9 -> H-9
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  const n = s.match(/^([A-Za-z]+)\s*-\s*(\d+)$/); // h-9 -> H-9
  if (n) return `${n[1].toUpperCase()}-${n[2]}`;
  return s.toUpperCase();
};

/**
 * Robust seat formatter for legacy shapes (string / number / ranges).
 */
const formatSeats = (
  rawInput,
  { seatsPerRow = 10, rows = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" } = {}
) => {
  if (rawInput == null) return "—";
  let input = rawInput;
  if (!Array.isArray(input)) input = [input];

  const expandToken = (token) => {
    if (token == null) return [];

    // object shape { row, col, label }
    if (typeof token === "object" && !Array.isArray(token)) {
      if (token.label) return [normalizeSeatLabel(token.label)];
      if ("row" in token && "col" in token) {
        const rawRow = token.row;
        const rn = Number(rawRow);
        let rowLetter;
        if (Number.isFinite(rn) && rn >= 1) {
          rowLetter = rows[rn - 1] ?? `R${rn}`;
        } else {
          rowLetter = String(rawRow ?? "").toUpperCase();
        }
        return [`${rowLetter}-${token.col}`];
      }
      return [];
    }

    if (typeof token === "number" && Number.isFinite(token)) {
      return [token];
    }

    if (typeof token === "string") {
      const s = token.trim();

      // "A-6", "A 6", "a_6", "A6"
      if (
        /^[A-Za-z]+\s*[-_\s]\s*\d+$/.test(s) ||
        /^[A-Za-z]+\d+$/.test(s)
      ) {
        const parts = s.split(/[-_\s]+/).filter(Boolean);
        if (parts.length >= 2)
          return [normalizeSeatLabel(`${parts[0]}-${parts[1]}`)];
        return [normalizeSeatLabel(s)];
      }

      // numeric range "5-10"
      if (/^\d+\s*-\s*\d+$/.test(s)) {
        const [a, b] = s
          .split("-")
          .map((x) => parseInt(x.trim(), 10))
          .sort((x, y) => x - y);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const out = [];
          for (let v = a; v <= b; v++) out.push(v);
          return out;
        }
      }

      // comma list "5,6,7" or "A-6,B-3"
      if (s.includes(",")) {
        return s.split(",").map((p) => p.trim()).flatMap(expandToken);
      }

      // single numeric "6"
      if (/^\d+$/.test(s)) return [Number(s)];

      return [s.toUpperCase()];
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
    if (typeof item === "string") {
      const s = String(item).trim();
      if (/^[A-Za-z]+\d+$/.test(s) || /^[A-Za-z]+\s*-\s*\d+$/.test(s)) {
        return normalizeSeatLabel(s);
      }
      return s;
    }
    return String(item);
  });

  const unique = Array.from(new Set(mapped));
  unique.sort((a, b) => {
    const pa = a.split("-");
    const pb = b.split("-");
    const ra = pa[0] ?? "";
    const rb = pb[0] ?? "";
    if (ra === rb) {
      const ca = parseInt(pa[1] || "0", 10) || 0;
      const cb = parseInt(pb[1] || "0", 10) || 0;
      return ca - cb;
    }
    return ra.localeCompare(rb);
  });

  if (unique.length === 0) return "—";
  return unique.join(", ");
};

/* --------------------------------- Page --------------------------------- */
// ✅ production fallback points to your deployed domain, not localhost
const APP_BASE =
  import.meta.env.VITE_APP_BASE_URL ||
  "https://movie-ticket-booking-rajy.netlify.app"; // default for production

export default function TicketDetails() {
  const { id: idFromRoute } = useParams();
  const location = useLocation();

  const urlToken = useMemo(
    () => new URLSearchParams(location.search).get("token") || null,
    [location.search]
  );

  const idFromState =
    location.state?.bookingId || location.state?.booking?._id || null;
  const bookingId = useMemo(
    () => idFromRoute ?? idFromState ?? null,
    [idFromRoute, idFromState]
  );

  const { token } = useAuth();
  const navigate = useNavigate();

  const printRef = useRef();
  const qrWrapRef = useRef();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/bookings/${bookingId}`, {
          params: urlToken ? { token: urlToken } : undefined,
          headers: urlToken
            ? {}
            : token
            ? { Authorization: `Bearer ${token}` }
            : {},
        });
        setBooking(data?.booking ?? null);
      } catch (err) {
        console.error("Error fetching booking:", err?.response || err);
        const status = err?.response?.status;
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Booking not found or unauthorized.";
        if (status === 401)
          setError("You must be logged in to view this ticket.");
        else setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) fetchBooking();
    else {
      setLoading(false);
      setError("Booking not found.");
    }
  }, [bookingId, token, urlToken]);

  /* ------------------------- Frontend seat formatting ------------------------ */

  // IMPORTANT: we also support older string/number formats coming from DB
  let seatsRaw = booking?.seats;
  if (typeof seatsRaw === "string") {
    if (/^\d+\s*-\s*\d+$/.test(seatsRaw)) {
      const [a, b] = seatsRaw
        .split("-")
        .map((x) => parseInt(x.trim(), 10));
      if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
        seatsRaw = Array.from({ length: b - a + 1 }, (_, i) => a + i);
      } else {
        seatsRaw = [seatsRaw];
      }
    } else if (seatsRaw.includes(",")) {
      seatsRaw = seatsRaw
        .split(",")
        .map((s) => s.trim())
        .map((s) => (/^\d+$/.test(s) ? parseInt(s, 10) : s));
    } else if (/^\d+$/.test(seatsRaw)) {
      seatsRaw = [parseInt(seatsRaw, 10)];
    } else {
      seatsRaw = [seatsRaw];
    }
  }
  const seatsFallback = formatSeats(seatsRaw, { seatsPerRow: 10 });

  // prefer backend-provided seat objects; supports { seatId }, { row, col }, { label }
  const renderSeatsInline = () => {
    if (Array.isArray(booking?.seats) && booking.seats.length > 0) {
      const mapped = booking.seats
        .map((s) => {
          if (!s) return null;

          // NEW: primary path – seats stored as { seatId: "1:9" }
          if (s.seatId) {
            const labelFromId = seatIdToLabel(s.seatId);
            return labelFromId ? normalizeSeatLabel(labelFromId) : null;
          }

          // optional label from backend
          if (s.label) return normalizeSeatLabel(s.label);

          // numeric row -> letter
          const rn = Number(s.row);
          if (Number.isFinite(rn) && rn >= 1) {
            const rows = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const letter = rows[rn - 1] ?? `R${rn}`;
            return `${letter}-${s.col ?? ""}`.replace(/-$/, "");
          }

          // raw row / col as string
          if (s.row != null || s.col != null) {
            return `${String(s.row ?? "").toUpperCase()}${
              s.col ? `-${s.col}` : ""
            }`.replace(/^-|-$|^$/, "");
          }

          return null;
        })
        .filter(Boolean);

      if (mapped.length > 0) {
        const unique = Array.from(new Set(mapped));
        unique.sort((a, b) => {
          const pa = a.split("-");
          const pb = b.split("-");
          const ra = pa[0] ?? "";
          const rb = pb[0] ?? "";
          if (ra === rb) {
            const ca = parseInt(pa[1] || "0", 10) || 0;
            const cb = parseInt(pb[1] || "0", 10) || 0;
            return ca - cb;
          }
          return ra.localeCompare(rb);
        });
        return unique.join(", ");
      }
    }

    // fallback – handles old-style seats stored as string/number
    return seatsFallback;
  };

  /* ---------------------------- Amount formatting --------------------------- */

  const rawAmount =
    booking?.totalAmount ??
    booking?.amount ??
    booking?.paymentAmount ??
    null;

  const amountText =
    rawAmount == null || Number.isNaN(Number(rawAmount))
      ? "—"
      : Number(rawAmount).toFixed(2);

  /* ---------------------------- Printing / PDF ----------------------------- */

  const downloadTicket = async () => {
    if (!booking) return;
    setMsg(null);
    setDownloading(true);

    try {
      if (booking.status === "CANCELLED") {
        setMsg("This booking was cancelled — PDF download disabled.");
        return;
      }

      const res = await api.get(`/bookings/${bookingId}/pdf`, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
        params: urlToken ? { token: urlToken } : undefined,
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Download ticket error:", err);
      const status = err?.response?.status;
      if (status === 401 || status === 403)
        setMsg("You are not authorized to download this ticket. Please login.");
      else if (status === 404) setMsg("Ticket PDF not found (404).");
      else if (status === 500) setMsg("Server error generating PDF.");
      else {
        if (err?.response?.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            setMsg(text || "Failed to download ticket");
          } catch {
            setMsg("Failed to download ticket");
          }
        } else {
          setMsg(err?.message || "Failed to download ticket");
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  const printTicket = () => {
    if (!booking) return;

    let qrImgHTML = "";
    try {
      const canvas = qrWrapRef.current?.querySelector("canvas");
      if (canvas && typeof canvas.toDataURL === "function") {
        const dataUrl = canvas.toDataURL("image/png");
        qrImgHTML = `<img src="${dataUrl}" width="170" height="170" style="display:block" />`;
      }
    } catch (e) {
      console.warn("Could not convert QR to image for print:", e);
    }

    const raw = printRef.current?.innerHTML || "";
    const printableHTML = raw.replace(
      /<div id="qr-slot"[^>]*>[\s\S]*?<\/div>/,
      `<div id="qr-slot" class="bg-white border border-slate-100 rounded-lg p-4 shadow-sm">${qrImgHTML || ""}</div>`
    );

    const popup = window.open("", "_blank", "width=800,height=900");
    if (!popup) {
      setMsg("Popup blocked — allow popups to print.");
      return;
    }
    popup.document.open();
    popup.document.write(`
      <html>
        <head>
          <title>Ticket - ${booking._id}</title>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; padding:20px; color:#0b2b46; }
            .ticket { max-width:720px; margin:0 auto; border-radius:16px; overflow:hidden; border:1px solid #e6eef6; }
            .header { background:#0071DC; color:white; padding:18px; text-align:center; font-weight:700; font-size:20px; }
            @media print {
              body { padding:0; }
              .ticket { border:none; box-shadow:none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${printableHTML}
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMsg("Link copied to clipboard.");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setMsg("Unable to copy link. Long-press and copy the address bar.");
    }
  };

  /* ------------------------------ Render logic ----------------------------- */

  if (loading) return <Loader text="Loading ticket..." />;

  if (error)
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-extrabold text-rose-600 mb-4">
            {error}
          </h2>
          <div className="flex justify-center gap-3">
            <PrimaryBtn onClick={() => navigate("/bookings")}>
              Back to My Bookings
            </PrimaryBtn>
            <GhostBtn onClick={() => navigate("/login")}>Login</GhostBtn>
          </div>
        </Card>
      </main>
    );

  if (!booking)
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-slate-500">Booking not found.</div>
      </main>
    );

  const show = booking.showtime || {};
  const movie = show?.movie?.title ?? "Unknown Movie";
  const screen = show?.screen?.name ?? "—";

  const showtimeValue = show.time || show.startTime || booking.createdAt;
  const formattedTime = showtimeValue
    ? new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(showtimeValue))
    : "—";

  const isCancelled = booking.status === "CANCELLED";
  const verifyUrl = `${APP_BASE}/tickets/verify/${booking._id}`;

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Ticket Details
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <GhostBtn onClick={() => navigate("/bookings")}>← Back</GhostBtn>
            <GhostBtn onClick={copyLink} title="Copy shareable link">
              Copy Link
            </GhostBtn>
            <GhostBtn onClick={printTicket}>Print Ticket</GhostBtn>
            <PrimaryBtn
              onClick={downloadTicket}
              disabled={downloading || isCancelled || !booking?._id}
            >
              {isCancelled
                ? "Ticket Cancelled"
                : downloading
                ? "Downloading..."
                : "Download PDF"}
            </PrimaryBtn>
          </div>
        </div>

        <div ref={printRef}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F] text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-lg">Cinema Ticket</div>
                <div className="text-xs/none opacity-90">
                  ID: {booking._id ?? "—"}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Card className="flex-1 p-5">
                  <h2 className="text-xl font-extrabold text-slate-900 mb-2">
                    {movie}
                  </h2>
                  <div className="text-sm text-slate-700 space-y-2">
                    <div>
                      <span className="font-semibold">Screen: </span>
                      {screen}
                    </div>
                    <div>
                      <span className="font-semibold">Seats: </span>
                      {renderSeatsInline()}
                    </div>
                    <div>
                      <span className="font-semibold">Showtime: </span>
                      {formattedTime}
                    </div>
                    <div>
                      <span className="font-semibold">Amount Paid: </span>₹
                      {amountText}
                    </div>
                    <div className="mt-2">
                      <span className="font-semibold">Status: </span>
                      <span
                        className={
                          isCancelled
                            ? "text-rose-700 font-bold"
                            : "text-emerald-700 font-bold"
                        }
                      >
                        {booking.status}
                      </span>
                    </div>
                    {isCancelled && booking.refundId && (
                      <div className="text-sm text-slate-500">
                        Refund processed (ID: {booking.refundId})
                      </div>
                    )}
                  </div>
                </Card>

                <div className="w-full md:w-56 flex flex-col items-center">
                  <Card id="qr-slot" ref={qrWrapRef} className="p-4">
                    <QRCodeCanvas value={verifyUrl} size={170} includeMargin />
                  </Card>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Scan to verify your booking
                  </p>
                </div>
              </div>

              <div className="my-6 border-b border-dashed border-slate-300" />

              <p className="text-center text-xs text-slate-500">
                Thank you for booking with{" "}
                <span className="font-semibold text-slate-700">
                  Cinema by Site
                </span>
                . Enjoy your movie!
              </p>
            </div>
          </Card>
        </div>

        {msg && (
          <Card
            className={`mt-6 px-4 py-3 font-semibold ${
              msg.toLowerCase().includes("failed") ||
              msg.toLowerCase().includes("error")
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {msg}
          </Card>
        )}
      </div>
    </main>
  );
}
