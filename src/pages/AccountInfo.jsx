// src/pages/AccountInfo.jsx — Walmart / District Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api, { makeAbsoluteImageUrl } from "../api/api";
// removed useNotifications import because your hook returns controls not notify()

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  id,
  helper,
}) {
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          pattern={pattern}
          maxLength={maxLength}
          className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
        />
      </div>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Helpers ------------------------------ */
const trim = (s) => String(s ?? "").trim();
const isTenDigitPhone = (s) => /^\d{10}$/.test(s || "");
const initials = (name) =>
  (String(name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("") || "U").toUpperCase();

/* Simple toast/emitter for local notifications (replace with your toast system) */
function emitToast(message, level = "info") {
  try {
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, level } }));
  } catch {}
}

/* ------------------------------ Component ------------------------------ */
export default function AccountInfo() {
  const { user, setUser, refreshProfile, logout } = useAuth() || {};
  // don't call useNotifications() here — it returns controls (close/reconnect/etc.)
  // const { notify } = useNotifications() || { notify: () => {} };

  const [form, setForm] = useState({ name: "", phone: "", preferences: {} });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // password modal
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  /* snapshot baseline */
  const baseline = useMemo(
    () => ({
      name: trim(user?.name || ""),
      phone: trim(user?.phone || ""),
      preferences: user?.preferences || {},
    }),
    [user]
  );

  useEffect(() => {
    if (!user) return;
    setForm(baseline);
  }, [user, baseline]);

  if (!user)
    return (
      <main className="min-h-[calc(100vh-80px)] bg-slate-50 grid place-items-center px-4">
        <Card className="max-w-md w-full p-6 text-center text-slate-900">Please login to view account info.</Card>
      </main>
    );

  const changed =
    trim(form.name) !== baseline.name ||
    trim(form.phone) !== baseline.phone ||
    JSON.stringify(form.preferences) !== JSON.stringify(baseline.preferences);

  /* ------------------------ SAVE PROFILE ------------------------ */
  async function save() {
    setErr("");
    setMsg("");

    const name = trim(form.name);
    const phone = trim(form.phone);

    if (!name) return setErr("Name is required.");
    if (phone && !isTenDigitPhone(phone)) return setErr("Please enter a valid 10-digit phone number.");
    if (!changed) return setMsg("No changes to save.");

    setLoading(true);
    try {
      const res = await api.put("/profile", { name, phone, preferences: form.preferences || {} });
      const updatedUser = res?.data?.user || res?.data;

      if (updatedUser) {
        setUser(updatedUser);
        try {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch {}
      }

      await refreshProfile?.();
      setMsg("Saved.");
      emitToast("Profile saved.", "success");
    } catch (e) {
      const message = e?.response?.data?.message || "Failed to save";
      setErr(message);
      emitToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------ REFRESH ------------------------ */
  async function doRefresh() {
    setErr("");
    setMsg("");

    try {
      await refreshProfile?.();
      setMsg("Refreshed.");
      emitToast("Profile refreshed.", "success");
    } catch (e) {
      setErr("Failed to refresh profile.");
      emitToast("Failed to refresh profile.", "error");
    }
  }

  /* ------------------------ CHANGE PASSWORD ------------------------ */
  async function changePassword() {
    setErr("");
    setMsg("");
    if (!pwCurrent || !pwNew) return setErr("Please fill current and new password.");
    if (pwNew.length < 8) return setErr("New password must be at least 8 characters.");

    setPwLoading(true);
    try {
      // backend route expects POST /api/profile/change-password (server mounts /api)
      await api.post("/profile/change-password", {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });

      setPwModalOpen(false);
      setPwCurrent("");
      setPwNew("");
      emitToast("Password updated.", "success");
      setMsg("Password changed.");
    } catch (e) {
      const message = e?.response?.data?.message || "Failed to change password";
      setErr(message);
      emitToast(message, "error");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[#0071DC]/10 flex items-center justify-center text-xl font-bold text-[#0071DC]">
              {user.avatar ? (
                <img
                  src={makeAbsoluteImageUrl(user.avatar)}
                  alt="avatar"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span>{initials(user.name || user.email || "U")}</span>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Account Info</h2>
              <p className="text-sm text-slate-600 mt-1">Manage your profile & settings.</p>
            </div>

            <SecondaryBtn
              onClick={() => {
                logout?.();
                try {
                  localStorage.removeItem("user");
                } catch {}
              }}
            >
              Logout
            </SecondaryBtn>
          </div>

          {/* Messages */}
          <div className="mt-6">
            {msg && (
              <Card className="mb-4 px-4 py-2 bg-emerald-50 border-emerald-200 text-emerald-700">{msg}</Card>
            )}
            {err && <Card className="mb-4 px-4 py-2 bg-rose-50 border-rose-200 text-rose-700">{err}</Card>}
          </div>

          {/* Form */}
          <div className="space-y-5 mt-4">
            {/* Email */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600">Email</label>
              <div className="mt-1 text-slate-900">{user.email}</div>
            </div>

            {/* Name */}
            <Field
              id="acc-name"
              label="Name"
              value={form.name}
              onChange={(v) => setForm((s) => ({ ...s, name: v }))}
              placeholder="Your name"
            />

            {/* Phone */}
            <Field
              id="acc-phone"
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((s) => ({ ...s, phone: String(v).replace(/[^\d]/g, "").slice(0, 10) }))}
              placeholder="10-digit mobile"
            />

            {/* Role */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600">Role</label>
              <div className="mt-1 text-slate-900">{user.role}</div>
            </div>

            {/* Member since */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600">Member since</label>
              <div className="mt-1 text-slate-900">
                {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 pt-2 items-center">
              <PrimaryBtn onClick={save} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </PrimaryBtn>

              <SecondaryBtn
                onClick={() => {
                  setForm(baseline);
                  setErr("");
                  setMsg("");
                }}
              >
                Reset
              </SecondaryBtn>

              <SecondaryBtn onClick={doRefresh}>Refresh</SecondaryBtn>

              <SecondaryBtn onClick={() => setPwModalOpen(true)}>Change password</SecondaryBtn>
            </div>
          </div>
        </Card>
      </div>

      {/* Password Modal */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pwLoading && setPwModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-lg p-6 z-10">
            <h3 className="text-xl font-semibold mb-2">Change password</h3>
            <p className="text-sm text-slate-600 mb-4">Enter your current password and a new one.</p>

            <div className="space-y-3">
              {/* Current */}
              <Field label="Current password" type="password" value={pwCurrent} onChange={setPwCurrent} />

              {/* New */}
              <Field label="New password" type="password" value={pwNew} onChange={setPwNew} />
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <SecondaryBtn onClick={() => !pwLoading && setPwModalOpen(false)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={changePassword} disabled={pwLoading}>
                {pwLoading ? "Updating..." : "Update password"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
