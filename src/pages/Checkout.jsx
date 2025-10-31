// src/pages/Checkout.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import Loader from "../components/Loader";
import { v4 as uuid } from "uuid";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Chip = ({ children, className = "" }) => (
  <span className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ${className}`}>
    {children}
  </span>
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ------------------------------- Helpers --------------------------------- */

/**
 * Simple post retry wrapper with jittered exponential backoff.
 * Returns axios response (not response.data) to match existing usage.
 */
async function postWithRetry(url, payload = {}, opts = {}, retries = 2, baseDelay = 400) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await api.post(url, payload, opts);
    } catch (err) {
      // If it's the last attempt, rethrow
      if (i === retries) throw err;
      // If network is offline, wait until online and then continue
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await new Promise((resolve) => {
          const onOnline = () => {
            window.removeEventListener("online", onOnline);
            resolve();
          };
          window.addEventListener("online", onOnline);
        });
      } else {
        // jittered exponential backoff
        const delay = baseDelay * Math.pow(2, i) + Math.round(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
}

/* ---------------------------- PosterImage --------------------------------
   Avoid Chromium lazy-placeholder intervention; fallback to local image on error.
   (decoding=async + loading="eager" help reliability).
*/
function PosterImage({ src, alt, className = "" }) {
  const onErr = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = "/logo_rounded.png";
  };

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
      onError={onErr}
      width="160"
      height="200"
    />
  );
}

/* -------------------------------- Component -------------------------------- */
export default function Checkout() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();

  // Fresh idempotency key per attempt
  const idemKeyRef = useRef(uuid());

  /* ---------- persisted cart (handles refresh) ---------- */
  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("checkoutData") || "null");
    } catch {
      return null;
    }
  }, []);

  const seats = state?.seats || stored?.seats || [];
  const basePrice = state?.basePrice ?? stored?.basePrice ?? 0;
  const amount = state?.amount ?? stored?.amount ?? seats.length * basePrice; // base tickets total

  /* ---------- local state ---------- */
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [order, setOrder] = useState(null);
  const [showtime, setShowtime] = useState(null);
  const [reloadKey, setReloadKey] = useState(0); // used to re-run create-order
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  // Razorpay script loaded flag
  const [rzpLoaded, setRzpLoaded] = useState(false);

  // Fee/tax (example; replace with backend values if available)
  const BOOKING_FEE_RATE = 0.245;
  const bookingCharge = +(amount * BOOKING_FEE_RATE).toFixed(2);
  const totalToPay = +(amount + bookingCharge).toFixed(2); // ✅ this is what we will charge

  /* ---------- route guard ---------- */
  useEffect(() => {
    if (!showtimeId || seats.length === 0) {
      navigate(`/seats/${showtimeId || ""}`, { replace: true });
    }
  }, [showtimeId, seats.length, navigate]);

  /* ---------- network online/offline handling ---------- */
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    // when coming online, try recreate order if missing
    const onOnlineRetry = () => {
      if (!order && showtimeId && seats.length) {
        console.info("[Checkout] Online -> retrying create-order by bumping reloadKey");
        setReloadKey((k) => k + 1);
      }
    };
    window.addEventListener("online", onOnlineRetry);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("online", onOnlineRetry);
    };
  }, [order, showtimeId, seats.length]);

  /* ---------- load Razorpay checkout script ---------- */
  useEffect(() => {
    let cancelled = false;
    const SRC = "https://checkout.razorpay.com/v1/checkout.js";

    if (typeof window !== "undefined" && window.Razorpay) {
      setRzpLoaded(true);
      return;
    }

    const existing = document.querySelector(`script[src="${SRC}"]`);
    if (existing) {
      const onLoad = () => !cancelled && setRzpLoaded(true);
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", () => !cancelled && setRzpLoaded(false));
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", () => {});
      };
    }

    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (!cancelled) setRzpLoaded(true);
    };
    s.onerror = () => {
      console.error("[Checkout] Failed to load Razorpay script");
      if (!cancelled) setRzpLoaded(false);
    };
    document.head.appendChild(s);

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- fetch showtime (for UI) ---------- */
  useEffect(() => {
    const run = async () => {
      if (!showtimeId) return;
      try {
        const { data } = await api.get(`/showtimes/${showtimeId}`);
        setShowtime(data?.data || data);
      } catch (err) {
        console.warn("[Checkout] fetch showtime failed:", err);
      }
    };
    run();
  }, [showtimeId]);

  /* ---------- STEP 1: create payment order (send FINAL total) ---------- */
  useEffect(() => {
    let mounted = true;
    const createOrder = async () => {
      try {
        setLoading(true);
        setMsg("");
        const payload = {
          // 👇 IMPORTANT: send the final total so Razorpay popup matches UI
          amount: totalToPay, // server converts to paise
          showtimeId,
        };
        console.info("[Checkout] Creating order with ₹", totalToPay, "payload:", payload);
        const res = await postWithRetry("/payments/create-order", payload, { timeout: 15000 }, 3);
        if (!mounted) return;
        setOrder(res.data);
        setMsg("");
        console.info("[Checkout] order initialized:", res.data);
      } catch (err) {
        console.error("❌ create-order failed:", err);
        // detect common network error
        if (err?.message?.includes("Network Error") || err?.code === "ERR_NETWORK") {
          setMsg("⚠️ Network issue while initializing payment. Reconnect or try again.");
        } else {
          setMsg("❌ Failed to create payment order. Try refreshing.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (showtimeId && seats.length) createOrder();

    return () => {
      mounted = false;
    };
    // include reloadKey so an online event can force re-run
  }, [showtimeId, seats.length, totalToPay, reloadKey]);

  /* ---------- keep seat lock alive on checkout ---------- */
  useEffect(() => {
    if (!showtimeId || !seats.length) return;
    let timer;
    let stopped = false;

    const keepAlive = async () => {
      if (stopped) return;
      try {
        // try a couple of retry attempts for the lock extend
        await postWithRetry("/bookings/lock/extend", { showtimeId, seats, holdSeconds: 120 }, { timeout: 10000 }, 1);
      } catch (err) {
        const res = err?.response?.data;
        const code = res?.code;
        if (code === "SEAT_UNAVAILABLE" || code === "LOCK_EXPIRED") {
          setMsg("⚠️ Your seat hold expired or was taken. Please reselect.");
          stopped = true;
          return;
        }
        console.warn("[Checkout] lock extend failed (non-fatal):", err);
      } finally {
        if (!stopped) timer = setTimeout(keepAlive, 60_000);
      }
    };

    timer = setTimeout(keepAlive, 60_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [showtimeId, seats]);

  /* ---------- countdown strip (10 min) ---------- */
  const [deadline] = useState(() => Date.now() + 10 * 60 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const msLeft = Math.max(0, deadline - now);
  const m = Math.floor(msLeft / 60000);
  const s = Math.floor((msLeft % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const progress = 1 - msLeft / (10 * 60 * 1000);

  /* ---------- helpers ---------- */
  const humanSeats = seats
    .map((s) => `${String.fromCharCode(64 + Number(s.row))}${Number(s.col)}`)
    .join(", ");

  const cinemaLine = (() => {
    const scn = showtime?.screen?.name || "Screen";
    const city = showtime?.city || "";
    const address = showtime?.theater?.address || "";
    return [scn, address || city].filter(Boolean).join(", ");
  })();

  /* ---------- STEP 2: Razorpay ---------- */
  const handlePayment = useCallback(async () => {
    if (!order) return alert("Order not initialized yet.");
    if (offline) {
      setMsg("⚠️ You are offline. Reconnect to make payment.");
      return;
    }
    setMsg("");
    idemKeyRef.current = uuid();

    // Ensure Razorpay script is loaded
    if (!rzpLoaded) {
      setMsg("⚠️ Payment gateway not ready. Please try again in a moment.");
      // Kick a background retry if script hasn't loaded
      const attemptLoad = () => {
        const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existing && window.Razorpay) setRzpLoaded(true);
      };
      setTimeout(attemptLoad, 1000);
      return;
    }

    // Ensure client key is present (exposed key id)
    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!keyId) {
      setMsg("❌ Payment not configured. Missing razorpay key.");
      console.error("[Checkout] Missing VITE_RAZORPAY_KEY_ID");
      return;
    }

    const options = {
      key: keyId,
      amount: order.amount, // already in paise from server
      currency: order.currency,
      name: "Cinema by Site",
      description: "Movie Ticket Booking",
      image: "/logo_rounded.png",
      order_id: order.id,

      config: {
        display: {
          sequence: [
            "block.upi_qr",
            "block.upi",
            "block.cards",
            "block.netbanking",
            "block.wallets",
            "block.paylater",
          ],
          blocks: {
            upi_qr: { name: "UPI QR", instruments: [{ method: "upi" }] },
            upi: { name: "UPI", instruments: [{ method: "upi" }] },
            cards: { name: "Cards" },
            netbanking: { name: "Netbanking" },
            wallets: { name: "Wallet" },
            paylater: { name: "Pay Later" },
          },
          preferences: { show_default_blocks: true },
        },
      },

      theme: { color: "#0654BA" },
      timeout: 15 * 60,

      modal: {
        backdropclose: false,
        escape: true,
        confirm_close: true,
        animation: true,
        ondismiss: () => setMsg("⚠️ Payment window closed."),
      },

      handler: async (response) => {
        try {
          // Verify payment
          const verifyRes = await postWithRetry("/payments/verify-payment", response, { timeout: 15000 }, 2);
          if (!verifyRes.data?.ok) {
            setMsg("❌ Payment verification failed!");
            return;
          }
          setMsg("✅ Payment verified! Confirming your booking...");

          // Confirm booking (idempotent) — send the same final amount used for payment
          try {
            const confirmRes = await postWithRetry(
              "/bookings/confirm",
              {
                showtimeId,
                seats,
                amount: totalToPay, // ✅ keep consistent with /create-order
                paymentProvider: "razorpay",
                paymentOrderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                paymentSignature: response.razorpay_signature,
              },
              { headers: { "Idempotency-Key": idemKeyRef.current }, timeout: 15000 },
              2
            );

            const booking = confirmRes?.data?.booking;
            setMsg("🎉 Booking confirmed successfully!");
            setTimeout(() => {
              booking?._id ? navigate(`/bookings/${booking._id}`) : navigate("/bookings");
            }, 900);
          } catch (err) {
            const status = err?.response?.status;
            if (status === 409) {
              const code = err?.response?.data?.code;
              if (code === "LOCK_EXPIRED") setMsg("⏰ Seat lock expired. Please reselect your seats.");
              else if (code === "DUPLICATE_CONFIRM") setMsg("🧾 Payment already processed. Check your bookings.");
              else setMsg("⚠️ Those seats were just taken. Please reselect.");
              setTimeout(() => navigate(`/seats/${showtimeId}`), 1400);
            } else if (status === 401) {
              setMsg("🔒 Please log in again to confirm your booking.");
              setTimeout(() => navigate("/login", { state: { redirectTo: `/seats/${showtimeId}` } }), 900);
            } else {
              setMsg("❌ Booking confirmation failed. Try again later.");
            }
          }
        } catch (err) {
          console.error("[Checkout] payment handler error:", err);
          setMsg("❌ Payment verification failed!");
        }
      },

      prefill: {
        name: "Test User",
        email: "testuser@example.com",
        contact: "9999999999",
      },
    };

    // open Razorpay UI
    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => setMsg("❌ Payment failed or cancelled."));
      rzp.open();
    } catch (err) {
      console.error("[Checkout] Razorpay open error:", err);
      setMsg("❌ Unable to open payment window.");
    }
  }, [order, showtimeId, seats, totalToPay, navigate, offline, rzpLoaded]);

  /* ---------- UI ---------- */
  if (!showtimeId || seats.length === 0) return <Loader text="Returning to seat selection..." />;
  if (loading) return <Loader text="Initializing Razorpay..." />;

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900">
      {/* Offline banner */}
      {offline && (
        <div className="sticky top-0 z-20 px-3 sm:px-4 md:px-6 lg:px-8 pt-3">
          <Card className="p-2 border-yellow-200 bg-yellow-50 text-yellow-800">
            You are offline — reconnect to continue. Some actions (payment) will be blocked.
          </Card>
        </div>
      )}

      {/* Countdown strip */}
      <div className="sticky top-0 z-10 px-3 sm:px-4 md:px-6 lg:px-8 pt-3">
        <Card className="overflow-hidden">
          <div className="h-3 bg-[#E6F0FE]">
            <div
              className="h-3 bg-[#C7DCF9] transition-[width] duration-1000"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
          <div className="text-center text-[13px] py-2">
            Complete your booking in <b>{m}:{s}</b> mins
          </div>
        </Card>
      </div>

      {/* Page container */}
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4">Review your booking</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* LEFT (2/3): Review card */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-start gap-4 p-4">
                {/* Poster */}
                <Card className="w-16 h-20 overflow-hidden p-0">
                  {showtime?.movie?.posterUrl ? (
                    <PosterImage
                      src={showtime.movie.posterUrl}
                      alt={showtime?.movie?.title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100" />
                  )}
                </Card>

                {/* Title + meta */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[18px] sm:text-lg font-extrabold">
                      {showtime?.movie?.title || "Movie"}
                    </h2>
                    {showtime?.movie?.certification && <Chip>{showtime.movie.certification}</Chip>}
                    {showtime?.movie?.format && <Chip>{showtime.movie.format}</Chip>}
                  </div>

                  <p className="text-sm text-slate-600">{showtime?.movie?.language || ""}</p>
                  <p className="text-xs text-slate-600">{cinemaLine}</p>

                  {/* Summary row */}
                  <Card className="mt-4">
                    <div className="flex items-center justify-between p-4">
                      <div className="text-sm text-slate-700">
                        <div className="font-bold">
                          {new Date(showtime?.startTime || showtime?.startAt).toLocaleDateString(
                            undefined,
                            { weekday: "short", day: "2-digit", month: "short" }
                          )}{" "}
                          •{" "}
                          {new Date(showtime?.startTime || showtime?.startAt).toLocaleTimeString(
                            [], { hour: "2-digit", minute: "2-digit" }
                          )}
                        </div>
                        <div className="text-slate-600">
                          {seats.length} ticket{seats.length > 1 ? "s" : ""} • {humanSeats}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-extrabold">₹{amount.toFixed(2)}</div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT (1/3): Summary + CTA */}
          <div className="lg:col-span-1 space-y-4">
            {/* Payment summary */}
            <Card>
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-[15px] font-extrabold">Payment summary</h3>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <Row label="Order amount" value={`₹${amount.toFixed(2)}`} />
                <Row label="Booking charge (inc. of GST)" value={`₹${bookingCharge.toFixed(2)}`} />
                <div className="pt-2 mt-2 border-t border-slate-200">
                  <Row label="To be paid" value={`₹${totalToPay.toFixed(2)}`} bold />
                </div>
              </div>
            </Card>

            {/* Sticky CTA card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase text-slate-700 tracking-wide">Total</div>
                <div className="text-lg font-extrabold">₹{totalToPay.toFixed(2)}</div>
              </div>
              <PrimaryBtn
                onClick={handlePayment}
                disabled={!order || loading || offline}
                className="w-full"
              >
                {offline ? "Offline" : order ? "Proceed To Pay" : "Preparing order…"}
              </PrimaryBtn>

              {msg && (
                <Card
                  className={`mt-3 p-3 ${
                    msg.includes("✅") || msg.includes("🎉")
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : msg.includes("⚠️")
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}
                >
                  {msg}
                </Card>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- tiny helper ---------- */
function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-700 ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`text-slate-900 ${bold ? "font-extrabold" : "font-semibold"}`}>{value}</span>
    </div>
  );
}
