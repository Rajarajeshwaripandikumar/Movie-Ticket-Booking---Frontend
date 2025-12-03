// src/pages/theatre/TheatreProfile.jsx — CLEAN VERSION (NO LOGO)

import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

/* ------------------------------ UI primitives ----------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-6 ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const Field = ({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
  error,
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">
      {label} {required ? <span className="text-rose-600">*</span> : null}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full mt-1 rounded-xl border px-3 py-2 text-sm focus:outline-none ${
        error
          ? "border-rose-300 ring-1 ring-rose-100"
          : "border-slate-300 focus:ring-2 focus:ring-[#0071DC]"
      }`}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-err` : undefined}
    />
    {error && (
      <p id={`${id}-err`} className="mt-1 text-xs text-rose-700">
        {error}
      </p>
    )}
  </div>
);

/* -------------------------------- Component ------------------------------- */
export default function TheatreProfile() {
  const { token, adminToken, user, isTheatreAdmin, refreshProfile } =
    useAuth() || {};

  const activeToken = adminToken || token || null;

  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?._id ||
    user?.theater?._id ||
    "";

  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    setMsg("");

    (async () => {
      if (!activeToken || !isTheatreAdmin) {
        setLoading(false);
        return;
      }
      try {
        const res =
          (await api.get(`/theatre/me`).catch(() => null)) ||
          (await api.get(`/theatre/${theatreId}`).catch(() => null)) ||
          (await api.get(`/admin/theaters/${theatreId}`).catch(() => null));

        const payload =
          res?.data?.theatre || res?.data?.theater || res?.data || null;

        if (!mounted) return;
        setTheatre(payload);
      } catch {
        if (!mounted) return;
        setErr("Failed to load theatre profile. Try again later.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeToken, isTheatreAdmin, theatreId]);

  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin)
    return (
      <div className="p-8 text-center text-rose-600 font-semibold">
        Access Denied
      </div>
    );

  const validate = () => {
    const errors = {};
    if (!theatre?.name?.trim()) errors.name = "Theatre name is required.";
    if (!theatre?.city?.trim()) errors.city = "City is required.";
    if (theatre?.address && theatre.address.trim().length < 5)
      errors.address = "Please enter a fuller address.";
    return errors;
  };

  const save = useCallback(async () => {
    if (!theatre) return;
    setErr("");
    setMsg("");

    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    try {
      await api.put(`/theatre/me`, theatre).catch(async () => {
        await api.put(`/theatre/${theatreId}`, theatre).catch(async () => {
          await api.put(`/admin/theaters/${theatreId}`, theatre);
        });
      });

      if (typeof refreshProfile === "function") {
        await refreshProfile().catch(() => {});
      }

      setMsg("Updated successfully.");
    } catch (e) {
      setErr("Failed to update theatre. Try again.");
    } finally {
      setSaving(false);
    }
  }, [theatre, theatreId, refreshProfile]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-full bg-slate-200 rounded" />
            <div className="h-3 w-3/4 bg-slate-200 rounded" />
          </div>
        </Card>
      </main>
    );
  }

  if (!theatre) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Card>No theatre found.</Card>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 ">
      <h1 className="text-2xl font-bold mb-6 text-[#0071DC]">My Theatre Profile</h1>

      <Card>
        <div className="space-y-4">
          {msg && (
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
              {msg}
            </div>
          )}
          {err && (
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-700">
              {err}
            </div>
          )}

          <Field
            id="theatre-name"
            label="Name"
            value={theatre.name || ""}
            onChange={(v) => setTheatre((t) => ({ ...t, name: v }))}
            required
            error={fieldErrors.name}
          />

          <Field
            id="theatre-city"
            label="City"
            value={theatre.city || ""}
            onChange={(v) => setTheatre((t) => ({ ...t, city: v }))}
            required
            error={fieldErrors.city}
          />

          <Field
            id="theatre-address"
            label="Address"
            value={theatre.address || ""}
            onChange={(v) => setTheatre((t) => ({ ...t, address: v }))}
            placeholder="Street, area, pincode (optional)"
            error={fieldErrors.address}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#0071DC] text-white px-4 py-2 font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try {
                  const res =
                    (await api.get(`/theatre/me`).catch(() => null)) ||
                    (await api.get(`/theatre/${theatreId}`).catch(() => null));
                  setTheatre(res?.data?.theatre || res?.data || null);
                  setMsg("Reloaded.");
                  setTimeout(() => setMsg(""), 1500);
                } catch {
                  setErr("Failed to reload profile.");
                } finally {
                  setLoading(false);
                }
              }}
              className="text-sm text-[#0654BA] underline"
            >
              Reload
            </button>
          </div>
        </div>
      </Card>
    </main>
  );
}
