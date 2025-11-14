// src/pages/AccountInfo.jsx — Walmart / District Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import useNotifications from "../hooks/useNotifications";

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

/* ------------------------------ Component ------------------------------ */
export default function AccountInfo() {
  const { user, setUser, refreshProfile, logout } = useAuth() || {};
  const { notify } = useNotifications() || { notify: () => {} };

  const [form, setForm] = useState({ name: "", phone: "", preferences: {} });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // password modal
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* snapshot for "no changes" check */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user)
    return (
      <main className="min-h-[calc(100vh-80px)] bg-slate-50 grid place-items-center px-4">
        <Card className="max-w-md w-full p-6 text-center text-slate-900">Please login to view account info.</Card>
      </main>
    );

  const changed =
    trim(form.name) !== baseline.name ||
    trim(form.phone) !== baseline.phone ||
    JSON.stringify(form.preferences || {}) !== JSON.stringify(baseline.preferences || {});

  async function save() {
    setErr("");
    setMsg("");

    const name = trim(form.name);
    const phone = trim(form.phone);

    if (!name) {
      setErr("Name is required.");
      return;
    }
    if (phone && !isTenDigitPhone(phone)) {
      setErr("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!changed) {
      setMsg("No changes to save.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.put("/profile", { name, phone, preferences: form.preferences || {} });
      const updatedUser = res?.data?.user || res?.data;
      if (updatedUser && setUser) {
        setUser(updatedUser);
        try {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (e) {
          console.warn("Could not persist user to localStorage:", e);
        }
      }
      if (typeof refreshProfile === "function") {
        try {
          await refreshProfile();
        } catch (e) {
          console.warn("refreshProfile failed:", e);
        }
      }
      setMsg("Saved.");
      notify("Profile saved.", "success");
    } catch (e) {
      console.error("Save account error:", e?.response?.status, e?.response?.data || e.message);
      const message = e?.response?.data?.message || "Failed to save";
      setErr(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function doRefresh() {
    setErr("");
    setMsg("");

    if (typeof refreshProfile === "function") {
      try {
        await refreshProfile();
        setMsg("Refreshed.");
        notify("Profile refreshed.", "success");
        return;
      } catch (e) {
        console.error("refreshProfile error:", e);
      }
    }

    try {
      const r = await api.get("/profile");
      const p = r?.data?.user || r?.data;
      if (p && setUser) {
        setUser(p);
        try {
          localStorage.setItem("user", JSON.stringify(p));
        } catch (e) {
          console.warn("Could not persist user to localStorage:", e);
        }
        setMsg("Refreshed.");
        notify("Profile refreshed.", "success");
      } else {
        setErr("Failed to refresh profile (unexpected response).");
        notify("Failed to refresh profile.", "error");
      }
    } catch (e) {
      console.error("GET /profile failed:", e?.response?.status, e?.response?.data || e.message);
      setErr("Failed to refresh profile");
      notify("Failed to refresh profile.", "error");
    }
  }

  async function changePassword() {
    setErr("");
    setMsg("");
    if (!pwCurrent || !pwNew) {
      setErr("Please fill current and new password.");
      return;
    }
    if (pwNew.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    setPwLoading(true);
    try {
      await api.put("/profile/password", { currentPassword: pwCurrent, newPassword: pwNew });
      setPwModalOpen(false);
      setPwCurrent("");
      setPwNew("");
      setMsg("Password changed.");
      notify("Password updated.", "success");
    } catch (e) {
      console.error("Change password failed:", e?.response?.data || e.message);
      const message = e?.response?.data?.message || "Failed to change password";
      setErr(message);
      notify(message, "error");
    } finally {
      setPwLoading(false);
    }
  }

  async function doDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setErr("");
    try {
      await api.delete("/profile");
      // local cleanup
      try {
        localStorage.removeItem("user");
      } catch (e) {}
      if (typeof logout === "function") {
        // call provided logout if present
        logout();
      } else if (setUser) {
        setUser(null);
      }
      notify("Account deleted.", "success");
      // redirecting handled by auth context / routes — just clear state here.
    } catch (e) {
      console.error("Delete account failed:", e?.response?.data || e.message);
      const message = e?.response?.data?.message || "Failed to delete account";
      setErr(message);
      notify(message, "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
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
                <img src={user.avatar} alt={`${user.name || "User"} avatar`} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <span aria-hidden>{initials(user.name || user.email || "U")}</span>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Account Info
              </h2>
              <p className="text-sm text-slate-600 mt-1">Manage your profile, password, and account settings.</p>
            </div>

            <div className="flex gap-2">
              <SecondaryBtn
                onClick={() => {
                  try {
                    // best-effort logout from client
                    if (typeof logout === "function") logout();
                    else if (setUser) setUser(null);
                    localStorage.removeItem("user");
                  } catch (e) {}
                }}
              >
                Logout
              </SecondaryBtn>
            </div>
          </div>

          {/* Messages */}
          <div className="mt-6">
            {msg && (
              <Card className="mb-4 px-4 py-2 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold">
                {msg}
              </Card>
            )}
            {err && (
              <Card className="mb-4 px-4 py-2 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
                {err}
              </Card>
            )}
          </div>

          {/* Form */}
          <div className="space-y-5 mt-4">
            {/* Email (read only) */}
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
              placeholder="Your full name"
              autoComplete="name"
              maxLength={80}
            />

            {/* Phone */}
            <Field
              id="acc-phone"
              label="Phone"
              value={form.phone}
              onChange={(v) =>
                setForm((s) => ({ ...s, phone: String(v).replace(/[^\d]/g, "").slice(0, 10) }))
              }
              placeholder="10-digit mobile"
              autoComplete="tel"
              inputMode="numeric"
              pattern="\\d{10}"
              helper="We’ll only use this for ticket updates."
            />

            {/* Role */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600">Role</label>
              <div className="mt-1 text-slate-900">{user.role || "USER"}</div>
            </div>

            {/* Member since */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600">Member since</label>
              <div className="mt-1 text-slate-900">{user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</div>
            </div>

            {/* Actions */}
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
                disabled={loading}
              >
                Reset
              </SecondaryBtn>

              <SecondaryBtn onClick={doRefresh} disabled={loading}>
                Refresh
              </SecondaryBtn>

              <SecondaryBtn onClick={() => setPwModalOpen(true)} disabled={loading}>
                Change password
              </SecondaryBtn>

              <button
                onClick={() => {
                  // destructive action area
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    setMsg("Click Delete again to confirm account deletion.");
                    return;
                  }
                  doDeleteAccount();
                }}
                disabled={deleting}
                className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              >
                {deleting ? "Deleting..." : confirmDelete ? "Confirm delete" : "Delete account"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Password modal (simple inline modal) */}
      {pwModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => !pwLoading && setPwModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-lg p-6 z-10">
            <h3 className="text-xl font-semibold mb-2">Change password</h3>
            <p className="text-sm text-slate-600 mb-4">Enter your current password and choose a new one (min 8 characters).</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Current password</label>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0071DC]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">New password</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#0071DC]"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <SecondaryBtn onClick={() => !pwLoading && setPwModalOpen(false)} disabled={pwLoading}>
                Cancel
              </SecondaryBtn>
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
