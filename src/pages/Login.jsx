// src/pages/LoginPage.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

/* ------------------------------ Inline Icons ------------------------------ */
const IconMail = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
const IconLock = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconArrow = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);

function Field({ type = "text", icon, placeholder, autoComplete, value, onChange, id }) {
  return (
    <div>
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        {icon && <span className="text-slate-500">{icon}</span>}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
          required
        />
      </div>
    </div>
  );
}

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const LinkBtn = ({ children, className = "", ...props }) => (
  <button
    className={`text-sm font-semibold underline decoration-2 underline-offset-4 text-[#0654BA] hover:text-[#004A99] ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* -------------------------------- Component ------------------------------- */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  /* ------------------------------ LOGIN FLOW ------------------------------ */
  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);

    try {
      await login(form.email, form.password, "USER");

      // get the updated role from localStorage
      const userRole = localStorage.getItem("role")?.toUpperCase();

      // If navigating from a protected page
      if (from && from !== "/login" && from !== "/admin/login") {
        navigate(from, { replace: true });
        return;
      }

      // Role based redirect
      if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
        navigate("/admin", { replace: true });
      } 
      else if (userRole === "THEATRE_ADMIN") {
        navigate("/theatre/my", { replace: true });
      } 
      else {
        navigate("/bookings", { replace: true });
      }

    } catch (error) {
      setErr(error?.response?.data?.message || error?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------- FORGOT PASSWORD ---------------------------- */
  async function handleForgotPassword(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setPreviewUrl("");

    if (!forgotEmail || !forgotEmail.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail });
      setMsg(res?.data?.message || "If that email exists, you'll receive reset instructions.");
      if (res?.data?.previewUrl) setPreviewUrl(res.data.previewUrl);
    } catch (error) {
      if (error?.response?.status === 404) {
        setMsg("Password reset is currently unavailable. Please try later.");
      } else {
        setErr(error?.response?.data?.message || "Error sending reset email");
      }
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------- RENDER -------------------------------- */
  return (
    <main className="min-h-screen w-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[560px] p-6 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-center mb-2">
          {showForgot ? "Reset Password" : "Sign In"}
        </h2>
        <p className="text-sm text-slate-600 text-center mb-4">
          {showForgot ? "Enter your email to receive reset instructions." : "Welcome back — please enter your credentials."}
        </p>

        {/* Messages */}
        {msg && <Card className="mb-4 p-3 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold">{msg}</Card>}
        {err && <Card className="mb-4 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{err}</Card>}

        {/* ---------------------------- LOGIN FORM ---------------------------- */}
        {!showForgot ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field
              type="email"
              icon={<IconMail />}
              placeholder="Email"
              autoComplete="email"
              value={form.email}
              onChange={(v) => setForm((s) => ({ ...s, email: v }))}
            />
            <Field
              type="password"
              icon={<IconLock />}
              placeholder="Password"
              autoComplete="current-password"
              value={form.password}
              onChange={(v) => setForm((s) => ({ ...s, password: v }))}
            />

            <PrimaryBtn type="submit" className="w-full" disabled={loading}>
              {loading ? "Processing..." : "Login"} <IconArrow />
            </PrimaryBtn>

            <div className="text-sm flex justify-between items-center">
              <LinkBtn
                type="button"
                onClick={() => {
                  setShowForgot(true);
                  setMsg("");
                  setErr("");
                  setPreviewUrl("");
                }}
              >
                Forgot password?
              </LinkBtn>
              <Link
                to="/register"
                className="text-sm font-semibold underline decoration-2 underline-offset-4 text-[#0654BA] hover:text-[#004A99]"
              >
                Create account
              </Link>
            </div>
          </form>
        ) : (
          /* ------------------------ FORGOT PASSWORD FORM ----------------------- */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Field
              type="email"
              icon={<IconMail />}
              placeholder="Enter your email"
              autoComplete="email"
              value={forgotEmail}
              onChange={setForgotEmail}
            />

            <PrimaryBtn type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"} <IconArrow />
            </PrimaryBtn>

            {previewUrl && (
              <div className="mt-1 text-sm">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline decoration-2 underline-offset-4 text-[#0654BA] hover:text-[#004A99]"
                >
                  Open dev email preview
                </a>
              </div>
            )}

            <LinkBtn
              type="button"
              onClick={() => {
                setShowForgot(false);
                setMsg("");
                setErr("");
                setPreviewUrl("");
              }}
            >
              Back to login
            </LinkBtn>
          </form>
        )}
      </Card>
    </main>
  );
}
