// src/pages/AdminLogin.jsx — Admin login for SUPER_ADMIN & THEATER_ADMIN
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

/* --------------------------- Walmart UI bits --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ label, type = "text", placeholder, value, onChange, autoComplete, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-[12px] font-semibold text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Component -------------------------------- */
export default function AdminLogin() {
  const { login } = useAuth();

  const [email, setEmail] = useState("admin@cinema.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // "auto" | "theatre" | "super"
  const [roleMode, setRoleMode] = useState("auto");

  const roleHint =
    roleMode === "auto"
      ? undefined
      : roleMode === "theatre"
      ? "THEATER_ADMIN"
      : "SUPER_ADMIN";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      // Pass chosen hint; AuthContext will decode JWT + redirect by final role.
      await login(email, password, roleHint);
      // No navigate() here — AuthContext already window.location.replace(...)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 flex items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-white/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Cinema Admin</h1>
              <p className="text-sm text-slate-600">Login as Super Admin or Theatre Admin</p>
            </div>
            <div className="rounded-full px-3 py-1 text-xs font-semibold bg-[#E6F0FE] text-[#0654BA] border border-[#C7DCF9]">
              Admin
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <Field
            id="admin-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="admin@cinema.com"
            autoComplete="username"
          />

          <Field
            id="admin-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="password"
            autoComplete="current-password"
          />

          {/* Role hint selector */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Role</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRoleMode("auto")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  roleMode === "auto" ? "border-[#0071DC] bg-[#E6F0FE] text-[#0654BA]" : "border-slate-300 bg-white"
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setRoleMode("theatre")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  roleMode === "theatre" ? "border-[#0071DC] bg-[#E6F0FE] text-[#0654BA]" : "border-slate-300 bg-white"
                }`}
              >
                Theatre Admin
              </button>
              <button
                type="button"
                onClick={() => setRoleMode("super")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                  roleMode === "super" ? "border-[#0071DC] bg-[#E6F0FE] text-[#0654BA]" : "border-slate-300 bg-white"
                }`}
              >
                Super Admin
              </button>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Auto lets the server/JWT decide (works great when your account is SUPER_ADMIN).
            </p>
          </div>

          {error && (
            <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">⚠️ {error}</Card>
          )}

          <PrimaryBtn type="submit" disabled={busy} className="w-full">
            {busy ? "Logging in…" : "Login"}
          </PrimaryBtn>

          <div className="flex flex-col items-center justify-center text-xs text-slate-700 mt-2">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@cinema.com");
                setPassword("");
                setError("");
                setRoleMode("auto");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            >
              Reset
            </button>

            <p className="text-slate-600 italic text-[13px] text-center mt-2">
              Tip: SUPER_ADMIN can leave role as <b>Auto</b>. Theatre admins can pick <b>Theatre Admin</b>.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center py-3 border-t border-slate-200 bg-white text-sm font-semibold text-slate-700">
          Admin © {new Date().getFullYear()}
        </div>
      </Card>
    </main>
  );
}
