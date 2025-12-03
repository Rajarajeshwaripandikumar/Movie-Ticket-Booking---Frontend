// src/pages/ResetPassword.jsx — Walmart Style (clean, rounded, blue accents)
// Polished: client validation, focus-first-invalid, accessibility, anti-double-submit, show/hide password

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

/* Field supports ref, error and show/hide toggle content placed to right */
const Field = React.forwardRef(({ id, name, type = "text", icon, placeholder, value, onChange, autoComplete, error, right }, ref) => {
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <div
        className={`flex items-center gap-2 border rounded-xl bg-white px-3 py-2 ${
          error ? "border-rose-300 ring-1 ring-rose-100" : "border-slate-300 focus-within:ring-2 focus-within:ring-[#0071DC]"
        }`}
      >
        {icon ? <span className="text-slate-600" aria-hidden>{icon}</span> : null}
        <input
          id={id}
          name={name}
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
          aria-invalid={!!error}
          aria-describedby={errId}
        />
        {right}
      </div>
      {error && (
        <p id={errId} className="mt-1 text-xs text-rose-700 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Icons ---------------------------------- */
const IconLock = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconEye = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10 10 0 012 12s4-7 10-7c2.02 0 3.88.5 5.5 1.36" />
    <path d="M1 1l22 22" />
  </svg>
);
const IconArrow = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

/* -------------------------------- Component -------------------------------- */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const email = (searchParams.get("email") || "").trim();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // refs to focus first invalid
  const refs = {
    password: useRef(null),
    confirm: useRef(null),
  };

  useEffect(() => {
    if (!token || !email) {
      setErr("Invalid reset link. Please use the link you received by email.");
    }
  }, [token, email]);

  const validate = () => {
    const e = {};
    const pw = password.trim();
    const cf = confirm.trim();

    if (!pw) e.password = "Password is required.";
    else if (pw.length < 6) e.password = "Password must be at least 6 characters.";
    if (!cf) e.confirm = "Please confirm your password.";
    else if (pw !== cf) e.confirm = "Passwords do not match.";

    return e;
  };

  const focusFirstInvalid = (errors) => {
    if (errors.password && refs.password.current) refs.password.current.focus();
    else if (errors.confirm && refs.confirm.current) refs.confirm.current.focus();
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setMsg("");
    setFieldErrors({});

    if (!token || !email) {
      setErr("Invalid reset link.");
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      focusFirstInvalid(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email,
        token,
        newPassword: password.trim(),
      });
      setMsg(res?.data?.message || "Password reset successful.");
      // small delay so user sees success toast
      setTimeout(() => navigate("/login"), 1200);
    } catch (e) {
      console.error("Reset error:", e);
      const server = e?.response?.data;
      if (server?.message) setErr(server.message);
      else setErr("Failed to reset password. The link may have expired.");
      // map server field errors if present
      if (server?.errors && typeof server.errors === "object") {
        setFieldErrors(server.errors);
        focusFirstInvalid(server.errors);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[560px] p-6 sm:p-7" role="region" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="text-xl sm:text-2xl font-extrabold tracking-tight text-center mb-2">
          Reset Password
        </h2>
        <p className="text-sm text-slate-600 text-center mb-4">
          Set a new password for <span className="font-semibold">{email || "your account"}</span>.
        </p>

        {/* Messages */}
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            id="password"
            name="password"
            ref={refs.password}
            type={showPwd ? "text" : "password"}
            icon={<IconLock />}
            placeholder="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            error={fieldErrors.password}
            right={
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="p-1 rounded-md hover:bg-slate-100"
                aria-pressed={showPwd}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            }
          />

          <Field
            id="confirm"
            name="confirm"
            ref={refs.confirm}
            type={showPwd ? "text" : "password"}
            icon={<IconLock />}
            placeholder="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={fieldErrors.confirm}
            right={
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="p-1 rounded-md hover:bg-slate-100"
                aria-hidden
                tabIndex={-1}
              >
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            }
          />

          <PrimaryBtn type="submit" disabled={loading || !token || !email} aria-disabled={loading || !token || !email}>
            {loading ? "Resetting..." : "Reset Password"} <IconArrow />
          </PrimaryBtn>

          <p className="text-xs text-slate-600 text-center">
            Link not working? Request a new one from the{" "}
            <Link to="/forgot-password" className="font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4">
              Forgot Password
            </Link>{" "}
            page.
          </p>
        </form>
      </Card>
    </main>
  );
}
