// src/pages/AccountInfo.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ label, type = "text", value, onChange, placeholder, autoComplete, inputMode, pattern, maxLength, id, helper }) {
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

/* ------------------------------ Component ------------------------------ */
const trim = (s) => String(s ?? "").trim();
const isTenDigitPhone = (s) => /^\d{10}$/.test(s || "");

export default function AccountInfo() {
  const { user, setUser, refreshProfile } = useAuth() || {};
  const [form, setForm] = useState({ name: "", phone: "", preferences: {} });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

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
    } catch (e) {
      console.error("Save account error:", e?.response?.status, e?.response?.data || e.message);
      setErr(e?.response?.data?.message || "Failed to save");
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
      } else {
        setErr("Failed to refresh profile (unexpected response).");
      }
    } catch (e) {
      console.error("GET /profile failed:", e?.response?.status, e?.response?.data || e.message);
      setErr("Failed to refresh profile");
    }
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="p-6 md:p-8">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-6">Account Info</h2>

          {/* Messages */}
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

          <div className="space-y-5">
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
            <div className="flex flex-wrap gap-3 pt-2">
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
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
