// src/pages/TicketDetails.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/Loader";
import { QRCodeCanvas } from "qrcode.react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = React.forwardRef(function Card({ children, className = "", as: Tag = "div", ...rest }, ref) {
  return (
    <Tag ref={ref} className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
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

/* --------------------------------- Page --------------------------------- */
// ✅ Fix: production fallback points to your deployed domain, not localhost
const APP_BASE =
  import.meta.env.VITE_APP_BASE_URL ||
  "https://movie-ticket-booking-rajy.netlify.app"; // default for production

console.log("[TicketDetails] APP_BASE =", APP_BASE);

export default function TicketDetails() {
  const { id: idFromRoute } = useParams();
  const location = useLocation();

  // token arriving from emailed/share link
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
          headers: urlToken ? {} : token ? { Authorization: `Bearer ${token}` } : {},
        });
        setBooking(data?.booking ?? null);
      } catch (err) {
        console.error("Error fetching booking:", err?.response || err);
        const status = err?.response?.status;
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Booking not found or unauthorized.";
        if (status === 401) setError("You must be logged in to view this ticket.");
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

  // Download ticket PDF
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

  if (loading) return <Loader text="Loading ticket..." />;

  if (error)
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-extrabold text-rose-600 mb-4">{error}</h2>
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
  const seats =
    booking.seats?.map((s) => `${s.row}-${s.col}`).join(", ") || "—";
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
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">🎟 Ticket Details</h1>
          <div className="flex flex-wrap items-center gap-2">
            <GhostBtn onClick={() => navigate("/bookings")}>← Back</GhostBtn>
            <GhostBtn onClick={copyLink} title="Copy shareable link">Copy Link</GhostBtn>
            <GhostBtn onClick={printTicket}>Print Ticket</GhostBtn>
            <PrimaryBtn
              onClick={downloadTicket}
              disabled={downloading || isCancelled || !booking?._id}
            >
              {isCancelled ? "Ticket Cancelled" : downloading ? "Downloading..." : "Download PDF"}
            </PrimaryBtn>
          </div>
        </div>

        <div ref={printRef}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F] text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-lg">Cinema Ticket</div>
                <div className="text-xs/none opacity-90">ID: {booking._id ?? "—"}</div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Card className="flex-1 p-5">
                  <h2 className="text-xl font-extrabold text-slate-900 mb-2">{movie}</h2>
                  <div className="text-sm text-slate-700 space-y-2">
                    <div><span className="font-semibold">Screen: </span>{screen}</div>
                    <div><span className="font-semibold">Seats: </span>{seats}</div>
                    <div><span className="font-semibold">Showtime: </span>{formattedTime}</div>
                    <div><span className="font-semibold">Amount Paid: </span>₹{booking.amount ?? "—"}</div>
                    <div className="mt-2">
                      <span className="font-semibold">Status: </span>
                      <span className={isCancelled ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                        {booking.status}
                      </span>
                    </div>
                    {isCancelled && booking.refundId && (
                      <div className="text-sm text-slate-500">Refund processed (ID: {booking.refundId})</div>
                    )}
                  </div>
                </Card>

                <div className="w-full md:w-56 flex flex-col items-center">
                  <Card id="qr-slot" ref={qrWrapRef} className="p-4">
                    <QRCodeCanvas value={verifyUrl} size={170} includeMargin />
                  </Card>
                  <p className="text-xs text-slate-500 mt-3 text-center">Scan to verify your booking</p>
                </div>
              </div>

              <div className="my-6 border-b border-dashed border-slate-300" />

              <p className="text-center text-xs text-slate-500">
                Thank you for booking with <span className="font-semibold text-slate-700">Cinema by Site</span>. Enjoy your movie!
              </p>
            </div>
          </Card>
        </div>

        {msg && (
          <Card
            className={`mt-6 px-4 py-3 font-semibold ${
              msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error")
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
