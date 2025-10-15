// src/pages/Register.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ------------------------------ Inline Icons ------------------------------ */
const IconUser = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);
const IconMail = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
const IconPhone = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.15 9.81 19.8 19.8 0 0 1 .08 1.18 2 2 0 0 1 2.06-.99h2a2 2 0 0 1 2 1.72c.12.9.33 1.78.61 2.62a2 2 0 0 1-.45 2.11L5.4 7.4a16 16 0 0 0 6.2 6.2l1.94-1.83a2 2 0 0 1 2.11-.45c.84.28 1.72.49 2.62.61a2 2 0 0 1 1.72 2.05" />
  </svg>
);
const IconLock = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconArrow = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
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
    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ------------------------------- Component ------------------------------- */
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const isAdmin = location.pathname.includes("/admin");
  const role = isAdmin ? "ADMIN" : "USER";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password) {
      setErr("All fields are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      setErr("Enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role,
      };
      const res = await api.post("/auth/register", payload);
      console.log("✅ Registration success:", res.data);
      setMsg("🎉 Registration successful! Redirecting to login...");
      setTimeout(() => navigate(isAdmin ? "/admin/login" : "/login"), 1200);
    } catch (e) {
      console.error("❌ Register error:", e);
      setErr(e?.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[720px] p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {isAdmin ? "Admin Registration" : "Create an Account"}
          </h2>
          <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#E6F0FE] text-[#0654BA] border border-[#C7DCF9]">
            {role}
          </span>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Enter your details to register {isAdmin ? "as an Admin." : "for your account."}
        </p>

        {/* Messages */}
        {msg && (
          <Card className="mb-4 p-3 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold">{msg}</Card>
        )}
        {err && (
          <Card className="mb-4 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{err}</Card>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Name + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              icon={<IconUser />}
              placeholder="Full Name"
              autoComplete="name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <Field
              type="email"
              icon={<IconMail />}
              placeholder="Email"
              autoComplete="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
          </div>

          {/* Phone */}
          <Field
            type="tel"
            icon={<IconPhone />}
            placeholder="Phone (10 digits)"
            autoComplete="tel"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          />

          {/* Passwords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              type="password"
              icon={<IconLock />}
              placeholder="Password"
              autoComplete="new-password"
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            />
            <Field
              type="password"
              icon={<IconLock />}
              placeholder="Confirm Password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(v) => setForm((f) => ({ ...f, confirmPassword: v }))}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <PrimaryBtn type="submit" disabled={loading}>
              {loading ? "Processing..." : "Register"} <IconArrow />
            </PrimaryBtn>

            <Link
              to={isAdmin ? "/admin/login" : "/login"}
              className="text-sm font-semibold underline decoration-2 underline-offset-4 text-[#0654BA] hover:text-[#004A99]"
            >
              Already have an account?
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
