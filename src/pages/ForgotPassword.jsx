// src/pages/ForgotPassword.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Field = ({ type = "text", icon, placeholder, value, onChange, autoComplete, required = false }) => (
  <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
    <span className="text-slate-600">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
      required={required}
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
function LinkBtn({ children, ...props }) {
  return (
    <button
      className="font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4"
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Inline icons ------------------------------ */
const IconMail = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
const IconKey = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="12" r="3.5" />
    <path d="M11 12h10l-2 2 2 2" />
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

/* -------------------------------- Component -------------------------------- */
export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState(1); // 1=request  2=reset
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(""); // token from email link or OTP
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestReset(e) {
    e?.preventDefault();
    setErr("");
    setMsg("");
    if (!email || !email.includes("@")) { setErr("Enter a valid email."); return; }
    try {
      setLoading(true);
      const res = await api.post("/auth/forgot-password", { email });
      setMsg(res.data?.message || "Reset instructions sent. Check your inbox.");
      setStep(2);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to send reset instructions");
    } finally { setLoading(false); }
  }

  async function submitReset(e) {
    e?.preventDefault();
    setErr("");
    setMsg("");
    if (!email || !email.includes("@")) { setErr("Email is required for reset."); return; }
    if (!token || !password) { setErr("Token and new password required"); return; }
    if (password !== confirm) { setErr("Passwords do not match"); return; }
    try {
      setLoading(true);
      // backend expects: { token, email, newPassword } (or password), include email
      const res = await api.post("/auth/reset-password", { token, email, newPassword: password });
      setMsg(res.data?.message || "Password reset successful. Login now.");
      setTimeout(() => nav("/login"), 1000);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reset password");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-[560px] p-6 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-center mb-2">
          {step === 1 ? "Forgot Password" : "Reset Password"}
        </h2>
        <p className="text-sm text-slate-600 text-center mb-4">
          {step === 1 ? "We’ll email you a reset link." : "Paste the token from your email and set a new password."}
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

        {step === 1 ? (
          <form onSubmit={requestReset} className="space-y-4">
            <Field
              type="email"
              icon={<IconMail />}
              placeholder="Your email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <PrimaryBtn disabled={loading} type="submit">
              {loading ? "Sending..." : "Send reset link"} <IconArrow />
            </PrimaryBtn>

            <div className="text-sm flex justify-between pt-1">
              <Link to="/login" className="font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4">
                Back to login
              </Link>
              <LinkBtn
                type="button"
                onClick={() => { setStep(2); setMsg(""); setErr(""); }}
              >
                I already have a token
              </LinkBtn>
            </div>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            {/* Always show email on reset step — prefilled if user came from step 1 */}
            <Field
              type="email"
              icon={<IconMail />}
              placeholder="Your email (used to identify account)"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <Field
              icon={<IconKey />}
              placeholder="Reset token (from email)"
              value={token}
              onChange={setToken}
              required
            />
            <Field
              type="password"
              icon={<IconLock />}
              placeholder="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
            />
            <Field
              type="password"
              icon={<IconLock />}
              placeholder="Confirm password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
            />

            <PrimaryBtn disabled={loading} type="submit">
              {loading ? "Resetting..." : "Reset password"} <IconArrow />
            </PrimaryBtn>

            <div className="text-sm flex justify-between pt-1">
              <LinkBtn
                type="button"
                onClick={() => { setStep(1); setMsg(""); setErr(""); }}
              >
                Start over
              </LinkBtn>
              <Link to="/login" className="font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4">
                Back to login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
