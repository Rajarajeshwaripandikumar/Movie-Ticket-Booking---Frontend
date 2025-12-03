// src/pages/Checkout.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import Loader from "../components/Loader";
import { v4 as uuid } from "uuid";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const Chip = ({ children, className = "" }) => (
  <span
    className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ${className}`}
  >
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
  const amount = state?.amount ?? stored?.amount ?? seats.length * basePrice;

  // Always send clean {row, col} seats for display / any future APIs
  const normalizedSeats = useMemo(
    () =>
      (seats || []).map((s) => ({
        row: Number(s.row),
        col: Number(s.col),
      })),
    [seats]
  );

  /* ---------- local state ---------- */
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [order, setOrder] = useState(null);
  const [showtime, setShowtime] = useState(null);

  // Fee/tax (example; replace with backend values if available)
  const BOOKING_FEE_RATE = 0.245;
  const bookingCharge = +(amount * BOOKING_FEE_RATE).toFixed(2);
  const totalToPay = +(amount + bookingCharge).toFixed(2);

  /* ---------- route guard ---------- */
  useEffect(() => {
    if (!showtimeId || normalizedSeats.length === 0) {
      navigate(`/seats/${showtimeId || ""}`, { replace: true });
    }
  }, [showtimeId, normalizedSeats.length, navigate]);

  /* ---------- fetch showtime (for UI) ---------- */
  useEffect(() => {
    const run = async () => {
      if (!showtimeId) return;
      try {
        const { data } = await api.get(`/showtimes/${showtimeId}`);
        setShowtime(data?.data || data);
      } catch {
        // non-blocking UI
      }
    };
    run();
  }, [showtimeId]);

  /* ---------- STEP 1: create payment order ---------- */
  useEffect(() => {
    const createOrder = async () => {
      try {
        setLoading(true);
        const { data } = await api.post("/payments/create-order", {
          amount, // server should convert to paise
          showtimeId,
        });
        setOrder(data);
      } catch (err) {
        console.error("❌ create-order failed:", err);
        setMsg("❌ Failed to create payment order.");
      } finally {
        setLoading(false);
      }
    };
    if (showtimeId && normalizedSeats.length) createOrder();
  }, [showtimeId, normalizedSeats.length, amount]);

  /* ---------- keep seat lock alive on checkout ---------- */
  useEffect(() => {
    if (!showtimeId || !normalizedSeats.length) return;
    let timer;
    let stopped = false;

    const keepAlive = async () => {
      if (stopped) return;
      try {
        // ✅ backend /bookings/lock/extend only needs showtimeId
        await api.post("/bookings/lock/extend", {
          showtimeId,
        });
      } catch (err) {
        const res = err?.response?.data;
        const code = res?.code;
        if (code === "SEAT_UNAVAILABLE" || code === "LOCK_EXPIRED") {
          setMsg("⚠️ Your seat hold expired or was taken. Please reselect.");
          stopped = true;
          return;
        }
      } finally {
        if (!stopped) timer = setTimeout(keepAlive, 60_000);
      }
    };

    timer = setTimeout(keepAlive, 60_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [showtimeId, normalizedSeats.length]);

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
  const humanSeats = normalizedSeats
    .map(
      (s) => `${String.fromCharCode(64 + Number(s.row))}${Number(s.col)}`
    )
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
    setMsg("");
    idemKeyRef.current = uuid();

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
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
          // Verify payment with backend
          const verifyRes = await api.post(
            "/payments/verify-payment",
            response
          );
          if (!verifyRes.data?.ok) {
            setMsg("❌ Payment verification failed!");
            return;
          }
          setMsg("✅ Payment verified! Confirming your booking...");

          // Confirm booking (idempotent, backend uses SeatLock as source of truth)
          try {
            const confirmRes = await api.post(
              "/bookings/confirm",
              {
                showtimeId,
                amount, // base ticket amount (backend will compute final)
                paymentProvider: "razorpay",
                paymentOrderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                paymentSignature: response.razorpay_signature,
              },
              {
                headers: {
                  "X-Idempotency-Key": idemKeyRef.current,
                },
                timeout: 15000,
              }
            );

            const booking = confirmRes?.data?.booking;
            setMsg("🎉 Booking confirmed successfully!");
            setTimeout(() => {
              booking?._id
                ? navigate(`/bookings/${booking._id}`)
                : navigate("/bookings");
            }, 900);
          } catch (err) {
            const status = err?.response?.status;
            const data = err?.response?.data;

            if (status === 409) {
              const code = data?.code;
              const error = data?.error || "";

              if (code === "LOCK_EXPIRED" || error.includes("No active seat locks")) {
                setMsg("⏰ Seat lock expired. Please reselect your seats.");
              } else if (code === "DUPLICATE_CONFIRM") {
                setMsg("🧾 Payment already processed. Check your bookings.");
              } else {
                setMsg(
                  "⚠️ Those seats were just taken or lock lost. Please reselect."
                );
              }
              setTimeout(() => navigate(`/seats/${showtimeId}`), 1400);
            } else if (status === 401) {
              setMsg("🔒 Please log in again to confirm your booking.");
              setTimeout(
                () =>
                  navigate("/login", {
                    state: { redirectTo: `/seats/${showtimeId}` },
                  }),
                900
              );
            } else {
              setMsg("❌ Booking confirmation failed. Try again later.");
            }
          }
        } catch {
          setMsg("❌ Payment verification failed!");
        }
      },

      prefill: {
        name: "Test User",
        email: "testuser@example.com",
        contact: "9999999999",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () =>
      setMsg("❌ Payment failed or cancelled.")
    );
    rzp.open();
  }, [order, showtimeId, amount, navigate]);

  /* ---------- UI ---------- */
  if (!showtimeId || normalizedSeats.length === 0)
    return <Loader text="Returning to seat selection..." />;
  if (loading) return <Loader text="Initializing Razorpay..." />;

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900">
      {/* Countdown strip */}
      <div className="sticky top-0 z-10 px-3 sm:px-4 md:px-6 lg:px-8 pt-3">
        <Card className="overflow-hidden">
          <div className="h-3 bg-[#E6F0FE]">
            <div
              className="h-3 bg-[#C7DCF9] transition-[width] duration-1000"
              style={{
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              }}
            />
          </div>
          <div className="text-center text-[13px] py-2">
            Complete your booking in{" "}
            <b>
              {m}:{s}
            </b>{" "}
            mins
          </div>
        </Card>
      </div>

      {/* Page container */}
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4">
          Review your booking
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* LEFT (2/3): Review card */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-start gap-4 p-4">
                {/* Poster */}
                <Card className="w-16 h-20 overflow-hidden p-0">
                  {showtime?.movie?.posterUrl ? (
                    <img
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
                    {showtime?.movie?.certification && (
                      <Chip>{showtime.movie.certification}</Chip>
                    )}
                    {showtime?.movie?.format && (
                      <Chip>{showtime.movie.format}</Chip>
                    )}
                  </div>

                  <p className="text-sm text-slate-600">
                    {showtime?.movie?.language || ""}
                  </p>
                  <p className="text-xs text-slate-600">{cinemaLine}</p>

                  {/* Summary row */}
                  <Card className="mt-4">
                    <div className="flex items-center justify-between p-4">
                      <div className="text-sm text-slate-700">
                        <div className="font-bold">
                          {new Date(
                            showtime?.startTime || showtime?.startAt
                          ).toLocaleDateString(undefined, {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}{" "}
                          •{" "}
                          {new Date(
                            showtime?.startTime || showtime?.startAt
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-slate-600">
                          {normalizedSeats.length} ticket
                          {normalizedSeats.length > 1 ? "s" : ""} •{" "}
                          {humanSeats}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-extrabold">
                          ₹{amount.toFixed(2)}
                        </div>
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
                <h3 className="text-[15px] font-extrabold">
                  Payment summary
                </h3>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <Row
                  label="Order amount"
                  value={`₹${amount.toFixed(2)}`}
                />
                <Row
                  label="Booking charge (inc. of GST)"
                  value={`₹${bookingCharge.toFixed(2)}`}
                />
                <div className="pt-2 mt-2 border-t border-slate-200">
                  <Row
                    label="To be paid"
                    value={`₹${totalToPay.toFixed(2)}`}
                    bold
                  />
                </div>
              </div>
            </Card>

            {/* Sticky CTA card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase text-slate-700 tracking-wide">
                  Total
                </div>
                <div className="text-lg font-extrabold">
                  ₹{totalToPay.toFixed(2)}
                </div>
              </div>
              <PrimaryBtn
                onClick={handlePayment}
                disabled={!order}
                className="w-full"
              >
                {order ? "Proceed To Pay" : "Preparing order…"}
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
      <span
        className={`text-slate-700 ${bold ? "font-semibold" : ""}`}
      >
        {label}
      </span>
      <span
        className={`text-slate-900 ${
          bold ? "font-extrabold" : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
