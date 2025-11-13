// src/pages/AdminLogin.jsx — robust redirect fallback + debug logs (patched)
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

/* --------------------------- UI bits (unchanged) --------------------------- */
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

/* ------------------------- safeNavigate helper ---------------------------- */
const safeNavigate = (navigateFn, to, opts = {}) => {
  try {
    if (!to) return;
    const current = window.location.pathname;
    const targetPath = new URL(to, window.location.origin).pathname;
    if (current === targetPath) return;
    navigateFn(to, opts);
  } catch (e) {
    // fallback (rare)
    navigateFn(to, opts);
  }
};

/* -------------------------------- Component -------------------------------- */
export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("admin@cinema.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      // await the login call — if it resolves but returns undefined,
      // we'll fall back to reading localStorage / AuthContext state.
      const returned = await loginAdmin(email, password);

      // Debugging logs — inspect these in the browser console
      console.debug("[AdminLogin] loginAdmin returned:", returned);
      console.debug("[AdminLogin] localStorage.token:", localStorage.getItem("token"));
      console.debug("[AdminLogin] localStorage.adminToken:", localStorage.getItem("adminToken"));
      console.debug("[AdminLogin] localStorage.user:", localStorage.getItem("user"));

      // prefer redirect target from router state (user attempted to access protected route)
      const fromPath = location.state?.from?.pathname;

      // Try to derive role & theatreId from returned value first, else from localStorage
      const userFromReturn = returned || (localStorage.getItem("user") && JSON.parse(localStorage.getItem("user")));
      const roleRaw = userFromReturn?.role ?? userFromReturn?.roles?.[0] ?? "";
      const role = String(roleRaw || "").toUpperCase();
      const theatreId = userFromReturn?.theatreId ?? userFromReturn?.theaterId ?? null;

      // canonical admin landing page — use /admin/screens so it matches AdminIndex logic
      const canonicalAdminLanding = "/admin/screens";

      // decide fallback:
      // 1) if router state has a 'from', prefer it
      // 2) else if super admin / admin -> canonicalAdminLanding
      // 3) else if theatre admin and we know a theater id -> use theatre-specific page (optional)
      // 4) else -> homepage
      let fallback = "/";
      if (fromPath) fallback = fromPath;
      else if (role === "SUPER_ADMIN" || role === "ADMIN") fallback = canonicalAdminLanding;
      else if (role === "THEATRE_ADMIN") fallback = theatreId ? `/theatre/view/${theatreId}` : "/theatre/my";

      // small timeout to allow AuthContext to finish any internal redirect first
      // but guard with safeNavigate to avoid repeated same-path navigation
      setTimeout(() => {
        // debug which path we will navigate to
        console.debug("[AdminLogin] Performing fallback navigate to:", fallback, "current:", window.location.pathname);
        safeNavigate(navigate, fallback, { replace: true });
      }, 120);

    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Login failed";
      console.error("[AdminLogin] login failed:", err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 flex items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-white/60 backdrop-blur">
          <h1 className="text-xl sm:text-2xl font-extrabold">Cinema Admin</h1>
          <p className="text-sm text-slate-600">Super Admin / Theatre Admin Only</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <Field id="admin-email" label="Email" type="email" value={email} onChange={setEmail} />
          <Field id="admin-password" label="Password" type="password" value={password} onChange={setPassword} />

          {error && (
            <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
              ⚠️ {error}
            </Card>
          )}

          <PrimaryBtn type="submit" disabled={busy} className="w-full">
            {busy ? "Logging in…" : "Login"}
          </PrimaryBtn>
        </form>

        <div className="text-center py-3 border-t border-slate-200 bg-white text-sm font-semibold text-slate-700">
          Admin © {new Date().getFullYear()}
        </div>
      </Card>
    </main>
  );
}
