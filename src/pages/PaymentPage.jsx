// src/pages/PaymentPage.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/**
 * Uses Razorpay classic checkout.
 * Ensure public/index.html includes:
 * <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 */

const RAZORPAY_KEY = "rzp_test_RQVPJlgqxDoGEu"; // test key you provided

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Muted = ({ children }) => (
  <p className="text-sm text-slate-600">{children}</p>
);

export default function PaymentPage() {
  const { state } = useLocation(); // { showtimeId, seats, total, bookingId?, payerName, payerEmail, payerContact }
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingPay, setLoadingPay] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!state?.total) return;

    (async () => {
      setLoadingInit(true);
      setError("");
      try {
        const payload = {
          amount: state.total,
          showtimeId: state.showtimeId,
          seats: state.seats,
          bookingId: state.bookingId || undefined,
          idempotencyKey: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        };

        const { data } = await api.post("/payments/create-order", payload);
        // server should return { orderId: 'order_xyz' } or { order: { id } }
        const gotOrderId = data?.orderId ?? data?.order?.id;
        if (!gotOrderId) throw new Error("Invalid order response from server");
        setOrderId(gotOrderId);
      } catch (err) {
        console.error("create-order failed:", err);
        setError(err?.response?.data?.message || err.message || "Failed to initialize payment");
      } finally {
        setLoadingInit(false);
      }
    })();
  }, [state]);

  if (!state)
    return (
      <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 text-center">No payment data provided.</Card>
      </main>
    );

  if (error)
    return (
      <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <div className="mb-2 font-extrabold">Error</div>
          <div className="text-sm text-rose-700">{error}</div>
        </Card>
      </main>
    );

  const openRazorpay = async () => {
    if (!orderId) return setError("Order not initialized");
    if (!window.Razorpay) {
      return setError(
        'Razorpay SDK not found. Add <script src="https://checkout.razorpay.com/v1/checkout.js"></script> to index.html'
      );
    }

    setLoadingPay(true);
    setError("");

    const options = {
      key: RAZORPAY_KEY,
      amount: Math.round(state.total * 100), // paise
      currency: "INR",
      name: "CineBook",
      description: "Movie Ticket Payment",
      image: "/logo.png",
      order_id: orderId,
      handler: async function (response) {
        try {
          // 1) verify signature on server
          await api.post("/payments/verify", {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            bookingId: state.bookingId,
          });

          // 2) confirm booking (server idempotent)
          await api.post("/bookings/confirm", {
            showtimeId: state.showtimeId,
            seats: state.seats,
            amount: state.total,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            bookingId: state.bookingId,
          });

          setLoadingPay(false);
          nav("/bookings/me");
        } catch (err) {
          console.error("Post-payment processing failed:", err);

          const status = err?.response?.status;
          if (status === 409) {
            // already confirmed — treat as success
            setLoadingPay(false);
            nav("/bookings/me");
            return;
          }

          const serverMsg = err?.response?.data?.message || err.message || "Post-payment processing failed";
          setError(serverMsg);
          setLoadingPay(false);
        }
      },
      prefill: {
        name: state.payerName || "Test User",
        email: state.payerEmail || "test@example.com",
        contact: state.payerContact || "9999999999",
      },
      notes: {
        showtimeId: state.showtimeId,
        seats: JSON.stringify(state.seats || []),
      },
      theme: { color: "#0654BA" }, // Walmart blue
      modal: {
        ondismiss: function () {
          setLoadingPay(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        console.error("razorpay payment.failed", resp);
        setError("Payment failed. Please try again.");
        setLoadingPay(false);
      });
      rzp.open();
    } catch (err) {
      console.error("Razorpay open error:", err);
      setError("Failed to open Razorpay checkout. See console for details.");
      setLoadingPay(false);
    }
  };

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-2">💳 Secure Checkout</h2>
        <Muted>Complete your payment securely using Razorpay</Muted>

        <Card className="p-4 mb-4">
          <div className="text-sm text-slate-700">Booking Total</div>
          <div className="font-extrabold text-lg">₹{state.total}</div>
        </Card>

        {loadingInit && <Card className="p-3 mb-4 text-sm text-slate-700">Preparing payment…</Card>}

        {!orderId ? (
          <Card className="p-3 text-sm text-slate-700">Preparing payment…</Card>
        ) : (
          <PrimaryBtn onClick={openRazorpay} disabled={loadingPay} className="w-full">
            {loadingPay ? "Processing..." : `Pay ₹${state.total}`}
          </PrimaryBtn>
        )}

        {error && (
          <Card className="mt-3 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{error}</Card>
        )}

        <p className="mt-4 text-xs text-slate-600">
          By clicking Pay you will be redirected to Razorpay to complete the transaction.
        </p>
      </Card>
    </main>
  );
}
