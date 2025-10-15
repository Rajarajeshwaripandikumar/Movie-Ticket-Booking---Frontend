// src/components/CheckoutForm.jsx — Walmart Style (clean, rounded, blue accents)
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useState, useMemo } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Banner = ({ tone = "info", children }) => {
  const styles =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : tone === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-blue-50 border-blue-200 text-blue-700";
  return <Card className={`p-3 text-sm font-semibold ${styles}`}>{children}</Card>;
};

/* -------------------------------- Component -------------------------------- */
export default function CheckoutForm({ showtimeId, seats, total }) {
  const stripe = useStripe();
  const elements = useElements();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("info");

  const payLabel = useMemo(() => {
    const v = Number(total || 0);
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(v);
    } catch {
      return `₹${v.toFixed(0)}`;
    }
  }, [total]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMsg("");
    setTone("info");

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        console.error("Stripe confirmPayment error", result.error);
        setTone("error");
        setMsg(result.error.message || "Payment failed. Please check your details and try again.");
        setLoading(false);
        return;
      }

      const pi = result.paymentIntent;
      if (!pi) {
        setTone("info");
        setMsg("Processing payment… you may be redirected to complete authentication.");
        setLoading(false);
        return;
      }

      switch (pi.status) {
        case "succeeded": {
          try {
            await api.post("/bookings/confirm", {
              showtimeId,
              seats,
              amount: total,
              paymentIntentId: pi.id,
            });
            setTone("success");
            setMsg("Payment successful! Booking confirmed.");
            setLoading(false);
            setTimeout(() => nav("/bookings"), 1200);
          } catch (be) {
            console.error("Booking confirm error", be);
            setTone("error");
            setMsg(
              "Payment captured, but booking confirmation failed. Your payment is safe — please contact support with your Payment ID: " +
                pi.id
            );
            setLoading(false);
          }
          return;
        }
        case "processing": {
          setTone("info");
          setMsg("Payment is processing… we’ll update your booking shortly.");
          setLoading(false);
          return;
        }
        case "requires_payment_method": {
          setTone("error");
          setMsg("Payment was declined. Please use a different card or try again.");
          setLoading(false);
          return;
        }
        default: {
          setTone("info");
          setMsg("Payment submitted. If additional steps are required, you’ll be redirected.");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Checkout error", err);
      setTone("error");
      setMsg(err?.response?.data?.message || err.message || "Payment failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </Card>

      <PrimaryBtn type="submit" disabled={!stripe || !elements || loading}>
        {loading ? "Processing..." : `Pay ${payLabel}`}
      </PrimaryBtn>

      {msg && <Banner tone={tone}>{msg}</Banner>}

      <p className="text-xs text-slate-500 text-center">
        Your payment is processed securely by Stripe. You may be asked to complete 3D Secure.
      </p>
    </form>
  );
}
