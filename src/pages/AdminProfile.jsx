// src/pages/AdminProfile.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ label, type = "text", value, onChange, placeholder, autoComplete, readOnly }) {
  return (
    <div>
      {label && (
        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
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

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Component -------------------------------- */
export default function AdminProfile() {
  const { adminToken, token, role, activeSession } = useAuth() || {};
  const sessionToken = adminToken || token || null;

  const r = String(role || "").toUpperCase();
  const isSuper = r === "SUPER_ADMIN";
  const isAdmin = r === "ADMIN";
  const isTheatre = r === "THEATRE_ADMIN";

  // 🔒 Route gating
  if (!sessionToken) return <Navigate to="/admin/login" replace />;
  if (isTheatre) return <Navigate to="/theatre/profile" replace />;
  if (!isSuper && !isAdmin) return <Navigate to="/" replace />;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    try {
      // Prefer admin endpoint when adminToken or active admin session is present
      const preferAdmin = !!adminToken || activeSession === "admin";
      const path = preferAdmin ? "/admin/me" : "/auth/me";

      const res = await api.get(path);
      const data = res?.data ?? res;
      const u = data.user || data || null;
      if (!u) {
        throw new Error("Profile response missing user");
      }
      setUser(u);
      setName(u.name || "");
      setEmail(u.email || "");
      setMsg("");
    } catch (e) {
      console.error("fetchProfile error", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || e.message || "Failed to fetch profile");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      // Try common update endpoints. If backend doesn't support it, show friendly message.
      const tryPaths = ["/admin/profile", "/auth/profile", "/auth/update", "/profile"];
      let res = null;
      let ok = false;

      for (const p of tryPaths) {
        try {
          res = await api.put(p, { name, email });
          ok = true;
          break;
        } catch (err) {
          // Continue to next candidate if 404 or not implemented
          if (err?.response?.status === 404 || err?.response?.status === 405) {
            continue;
          }
          throw err;
        }
      }

      if (!ok) {
        setMsgType("info");
        setMsg("Profile update is not available on the server. Ask the backend team to enable PUT /api/auth/profile.");
        setLoading(false);
        return;
      }

      const data = res?.data ?? {};
      const updated = data.user || { ...(user || {}), name, email };
      setUser(updated);
      setName(updated.name || "");
      setEmail(updated.email || "");
      setMsgType("success");
      setMsg(data.message || "Profile updated");
    } catch (e) {
      console.error("saveProfile err", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || e.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (!currentPassword || !newPassword) {
        setMsgType("error");
        setMsg("Please provide current and new password.");
        setLoading(false);
        return;
      }
      if (newPassword.length < 8) {
        setMsgType("error");
        setMsg("New password must be at least 8 characters.");
        setLoading(false);
        return;
      }

      // Prefer admin change endpoint when admin session
      const preferAdmin = !!adminToken || activeSession === "admin";
      const pathCandidates = preferAdmin ? ["/admin/change-password", "/auth/change-password"] : ["/auth/change-password", "/change-password"];

      let res = null;
      let ok = false;
      for (const p of pathCandidates) {
        try {
          res = await api.post(p, { currentPassword, newPassword });
          ok = true;
          break;
        } catch (err) {
          if (err?.response?.status === 404 || err?.response?.status === 405) continue;
          throw err;
        }
      }

      if (!ok) {
        setMsgType("info");
        setMsg("Password change endpoint not available. Ask backend to add POST /api/auth/change-password.");
        setLoading(false);
        return;
      }

      setMsgType("success");
      setMsg(res?.data?.message || "Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      console.error("changePassword err", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || e.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  const initials =
    (user?.name || "")
      .trim()
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "AD";

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Admin Profile</h2>
              <p className="text-sm text-slate-600">
                {isSuper ? "Super Admin" : "Admin"} — update your password and details.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 grid place-items-center shadow-sm text-sm font-extrabold text-slate-800">
              {initials}
            </div>
          </div>
        </Card>

        {msg && (
          <Card
            className={`p-3 font-semibold ${
              msgType === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : msgType === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {msg}
          </Card>
        )}

        {/* Profile form */}
        <Card className="p-5">
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Name" value={name} onChange={setName} autoComplete="name" />
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />

            <div className="flex items-center justify-end gap-2 pt-1">
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setName(user?.name || "");
                  setEmail(user?.email || "");
                  setMsg("");
                }}
              >
                Reset
              </SecondaryBtn>
              <PrimaryBtn disabled={loading}>
                {loading ? "Saving..." : "Save Profile"}
              </PrimaryBtn>
            </div>
          </form>
          <p className="text-[11px] text-slate-500 mt-2">
            If saving profile shows “not available”, ask backend to add <code>PUT /api/auth/profile</code>.
          </p>
        </Card>

        {/* Password form */}
        <Card className="p-5">
          <h3 className="text-lg font-extrabold mb-3">Change Password</h3>
          <form onSubmit={changePassword} className="space-y-3" autoComplete="off">
            <Field
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              placeholder="Current password"
            />
            <Field
              label="New Password (min 8 chars)"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="New password"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                }}
              >
                Clear
              </SecondaryBtn>
              <PrimaryBtn disabled={loading}>
                {loading ? "Updating..." : "Change Password"}
              </PrimaryBtn>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
