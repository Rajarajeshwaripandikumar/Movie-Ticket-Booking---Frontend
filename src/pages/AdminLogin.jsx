// src/pages/AdminLogin.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

/* --------------------------- UI bits (District/Walmart) --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ label, type = "text", placeholder, value, onChange, autoComplete, id, inputProps = {} }) {
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
          {...inputProps}
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

function LinkLikeButton({ children, className = "", ...props }) {
  return (
    <button {...props} className={`text-sm text-[#0654BA] underline underline-offset-2 ${className}`}>
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
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
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
      // Call loginAdmin from AuthContext. It will:
      // - call /auth/login
      // - validate role (SUPER_ADMIN / THEATER_ADMIN / ADMIN)
      // - set tokens & session
      const returned = await loginAdmin(email.trim(), password);

      // Helpful debug logs
      console.debug("[AdminLogin] loginAdmin returned:", returned);
      console.debug("[AdminLogin] localStorage.adminToken:", localStorage.getItem("adminToken"));
      console.debug("[AdminLogin] localStorage.token:", localStorage.getItem("token"));
      console.debug("[AdminLogin] localStorage.user:", localStorage.getItem("user"));

      // Determine redirect: prefer router state 'from', else role-based fallback
      const fromPath = location.state?.from?.pathname;

      const userFromReturn =
        returned || (localStorage.getItem("user") && JSON.parse(localStorage.getItem("user")));

      const roleRaw = userFromReturn?.role ?? userFromReturn?.roles?.[0] ?? "";
      const role = String(roleRaw || "").toUpperCase();

      const theaterId =
        userFromReturn?.theaterId ??
        userFromReturn?.theatreId ??
        null;

      // adjust this if your canonical admin landing is different
      const canonicalAdminLanding = "/admin/dashboard";

      let fallback = "/";
      if (fromPath) {
        fallback = fromPath;
      } else if (role === "SUPER_ADMIN" || role === "ADMIN") {
        fallback = canonicalAdminLanding;
      } else if (role === "THEATER_ADMIN") {
  // theatre admins always land on their dashboard
  fallback = "/theatre/dashboard";
}


      // small defer to allow AuthContext to finish any state changes
      setTimeout(() => {
        console.debug("[AdminLogin] navigating to:", fallback, "current:", window.location.pathname);
        safeNavigate(navigate, fallback, { replace: true });
      }, 120);

      // remember-me: if user doesn't want to persist tokens, remove them from localStorage
      if (!remember) {
        try {
          localStorage.removeItem("adminToken");
        } catch {}
      }
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
          <p className="text-sm text-slate-600">Super Admin / Theatre Admin only</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <Field
            id="admin-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
          />
          <Field
            id="admin-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            inputProps={{
              minLength: 6,
            }}
          />

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(Boolean(e.target.checked))}
                className="h-4 w-4"
              />
            </label>

            <div className="flex items-center gap-3">
              <LinkLikeButton type="button" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "Hide" : "Show"}
              </LinkLikeButton>
              <LinkLikeButton
                type="button"
                onClick={() => {
                  // Simpler: use the shared forgot-password page
                  safeNavigate(navigate, "/forgot-password");
                }}
              >
                Forgot?
              </LinkLikeButton>
            </div>
          </div>

          {error && (
            <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
              ⚠️ {error}
            </Card>
          )}

          <PrimaryBtn type="submit" disabled={busy} className="w-full">
            {busy ? "Logging in…" : "Login"}
          </PrimaryBtn>

          <div className="text-center text-xs text-slate-500">
            Tip: Use Super-Admin credentials.
             Username: admin@cinema.com & Password: 123456789
          </div>
        </form>

        
      </Card>
    </main>
  );
}
