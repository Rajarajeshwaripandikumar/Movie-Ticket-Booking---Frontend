// src/pages/Register.jsx — Walmart Style (clean, rounded, blue accents)
// Enhanced: per-field validation, phone normalization, accessibility, focus-first-invalid, anti-double-submit

import React, { useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";

/* ------------------------------ Inline Icons ------------------------------ */
const IconUser = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);
const IconMail = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
const IconPhone = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.15 9.81 19.8 19.8 0 0 1 .08 1.18 2 2 0 0 1 2.06-.99h2a2 2 0 0 1 2 1.72c.12.9.33 1.78.61 2.62a2 2 0 0 1-.45 2.11L5.4 7.4a16 16 0 0 0 6.2 6.2l1.94-1.83a2 2 0 0 1 2.11-.45c.84.28 1.72.49 2.62.61a2 2 0 0 1 1.72 2.05" />
  </svg>
);
const IconLock = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconArrow = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

/* Field component accepts ref and supports error display via aria-describedby */
const Field = React.forwardRef(
  ({ id, name, type = "text", icon, placeholder, autoComplete, value, onChange, error }, ref) => {
    const errId = error ? `${id}-err` : undefined;
    return (
      <div>
        <div
          className={`flex items-center gap-2 border rounded-xl bg-white px-3 py-2 focus-within:ring-2 ${
            error ? "border-rose-300 focus-within:ring-rose-200" : "border-slate-300 focus-within:ring-[#0071DC]"
          }`}
        >
          {icon && <span className="text-slate-500" aria-hidden>{icon}</span>}
          <input
            id={id}
            name={name}
            ref={ref}
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            value={value}
            onChange={onChange}
            className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
            aria-invalid={!!error}
            aria-describedby={errId}
          />
        </div>
        {error && (
          <p id={`${id}-err`} className="mt-1 text-xs text-rose-700 font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ------------------------------- Helpers --------------------------------- */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const trimAll = (obj) => {
  const clone = {};
  for (const k in obj) clone[k] = typeof obj[k] === "string" ? obj[k].trim() : obj[k];
  return clone;
};

/* -------------------------------- Component ------------------------------- */
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(""); // global API error
  const [fieldErrors, setFieldErrors] = useState({});

  const isAdmin = location.pathname.includes("/admin");
  const role = isAdmin ? "ADMIN" : "USER";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // refs for focusing the first invalid field
  const refs = {
    name: useRef(null),
    email: useRef(null),
    phone: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
  };

  /* update handler - phone normalized to digits-only and max 10 */
  const handleChange = (name) => (e) => {
    let value = e.target.value;
    if (name === "phone") {
      // normalize to digits only while typing
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    setForm((f) => ({ ...f, [name]: value }));
    // clear field error while editing
    setFieldErrors((fe) => ({ ...fe, [name]: "" }));
    setErr("");
    setMsg("");
  };

  /* client validation - returns errors object */
  const validate = (values) => {
    const errors = {};
    const v = trimAll(values);

    if (!v.name) errors.name = "Full name is required.";
    if (!v.email) errors.email = "Email is required.";
    else if (!emailRegex.test(v.email)) errors.email = "Enter a valid email address.";
    if (!v.phone) errors.phone = "Phone number is required.";
    else if (!/^\d{10}$/.test(v.phone)) errors.phone = "Enter a valid 10-digit phone number.";
    if (!v.password) errors.password = "Password is required.";
    else if (v.password.length < 6) errors.password = "Password must be at least 6 characters.";
    if (!v.confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (v.password !== v.confirmPassword) errors.confirmPassword = "Passwords do not match.";

    return errors;
  };

  const focusFirstInvalid = (errors) => {
    const order = ["name", "email", "phone", "password", "confirmPassword"];
    for (const key of order) {
      if (errors[key] && refs[key]?.current) {
        refs[key].current.focus();
        return;
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit

    setErr("");
    setMsg("");
    const errors = validate(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      focusFirstInvalid(errors);
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
      // small delay for UX
      setTimeout(() => navigate(isAdmin ? "/admin/login" : "/login"), 1100);
    } catch (e) {
      console.error("❌ Register error:", e);
      // prefer server message if present
      const serverMessage = e?.response?.data?.message || e?.message;
      setErr(serverMessage || "Registration failed. Try again.");
      // if server returns field errors object, map them to fieldErrors (optional)
      const serverFieldErrors = e?.response?.data?.errors;
      if (serverFieldErrors && typeof serverFieldErrors === "object") {
        setFieldErrors(serverFieldErrors);
        focusFirstInvalid(serverFieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[720px] p-6 sm:p-8" role="region" aria-labelledby="register-heading">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="register-heading" className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {isAdmin ? "Admin Registration" : "Create an Account"}
          </h2>
          <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#E6F0FE] text-[#0654BA] border border-[#C7DCF9]">
            {role}
          </span>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Enter your details to register {isAdmin ? "as an Admin." : "for your account."}
        </p>

        {/* Global messages */}
        {msg && (
          <Card className="mb-4 p-3 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold" role="status" aria-live="polite">
            {msg}
          </Card>
        )}
        {err && (
          <Card className="mb-4 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold" role="alert" aria-live="assertive">
            {err}
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          {/* Name + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              id="name"
              name="name"
              ref={refs.name}
              icon={<IconUser />}
              placeholder="Full Name"
              autoComplete="name"
              value={form.name}
              onChange={handleChange("name")}
              error={fieldErrors.name}
            />
            <Field
              id="email"
              name="email"
              ref={refs.email}
              type="email"
              icon={<IconMail />}
              placeholder="Email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
              error={fieldErrors.email}
            />
          </div>

          {/* Phone */}
          <Field
            id="phone"
            name="phone"
            ref={refs.phone}
            type="tel"
            icon={<IconPhone />}
            placeholder="Phone (10 digits)"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange("phone")}
            error={fieldErrors.phone}
          />

          {/* Passwords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              id="password"
              name="password"
              ref={refs.password}
              type="password"
              icon={<IconLock />}
              placeholder="Password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange("password")}
              error={fieldErrors.password}
            />
            <Field
              id="confirmPassword"
              name="confirmPassword"
              ref={refs.confirmPassword}
              type="password"
              icon={<IconLock />}
              placeholder="Confirm Password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              error={fieldErrors.confirmPassword}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <PrimaryBtn type="submit" disabled={loading} aria-disabled={loading}>
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
