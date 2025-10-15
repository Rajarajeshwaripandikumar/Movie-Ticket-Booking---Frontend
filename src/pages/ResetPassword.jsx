// src/pages/ResetPassword.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Field = ({ type = "text", icon, placeholder, value, onChange, autoComplete }) => (
  <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
    {icon ? <span className="text-slate-600">{icon}</span> : null}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
      required
    />
  </div>
);

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

/* -------------------------------- Component -------------------------------- */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setErr("Invalid reset link. Please use the link you received by email.");
    }
  }, [token, email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        email,
        token,
        newPassword: password,
      });
      setMsg(res?.data?.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 1400);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[560px] p-6 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-center mb-2">
          Reset Password
        </h2>
        <p className="text-sm text-slate-600 text-center mb-4">
          Set a new password for{" "}
          <span className="font-semibold">{email || "your account"}</span>.
        </p>

        {/* Messages */}
        {msg && (
          <Card className="mb-4 p-3 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold">
            {msg}
          </Card>
        )}
        {err && (
          <Card className="mb-4 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
            {err}
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            type="password"
            icon={<IconLock />}
            placeholder="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <Field
            type="password"
            icon={<IconLock />}
            placeholder="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />

          <PrimaryBtn type="submit" disabled={loading || !token || !email}>
            {loading ? "Resetting..." : "Reset Password"} <IconArrow />
          </PrimaryBtn>

          {/* Subtext */}
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
