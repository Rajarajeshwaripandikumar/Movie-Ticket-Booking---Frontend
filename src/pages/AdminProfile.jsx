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

function Field({ label, type = "text", value, onChange, placeholder, autoComplete }) {
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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
  const { token, role } = useAuth() || {};
  const isAdmin = String(role || "").toUpperCase() === "ADMIN";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // 🔒 Route gating
  if (!token) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    try {
      const { data } = await api.get("/admin/me"); // admin endpoint
      const u = data.user || data;
      setUser(u);
      setName(u.name || "");
      setEmail(u.email || "");
      setMsg("");
    } catch (e) {
      console.error("fetchProfile error", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || "Failed to fetch admin profile");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const { data } = await api.put("/admin/profile", { name, email }); // admin endpoint
      setUser(data.user || data);
      setMsgType("success");
      setMsg(data.message || "Admin profile updated");
    } catch (e) {
      console.error("saveProfile err", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || "Failed to update admin profile");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const { data } = await api.post("/admin/change-password", {
        currentPassword,
        newPassword,
      }); // admin endpoint
      setMsgType("success");
      setMsg(data.message || "Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      console.error("changePassword err", e?.response || e);
      setMsgType("error");
      setMsg(e?.response?.data?.message || "Failed to change password");
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
              <p className="text-sm text-slate-600">Update your profile and password.</p>
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
