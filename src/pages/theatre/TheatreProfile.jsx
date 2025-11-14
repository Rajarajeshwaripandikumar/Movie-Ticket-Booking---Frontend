// src/pages/theatre/TheatreProfile.jsx — polished Theatre profile (District / Walmart style)
import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

/* ------------------------------ UI primitives ----------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-6 ${className}`} {...rest}>
    {children}
  </Tag>
);

const Field = ({ id, label, value, onChange, placeholder = "", type = "text", required = false, error }) => (
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
        error ? "border-rose-300 ring-1 ring-rose-100" : "border-slate-300 focus:ring-2 focus:ring-[#0071DC]"
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

/* ------------------------------- helpers --------------------------------- */
function decodeJwt(t) {
  try {
    if (!t) return {};
    const payload = String(t).split(".")[1];
    return payload ? JSON.parse(atob(payload)) : {};
  } catch {
    return {};
  }
}

/* -------------------------------- Component ------------------------------- */
export default function TheatreProfile() {
  const { token, adminToken, user, isTheatreAdmin, refreshProfile } = useAuth() || {};
  const activeToken = adminToken || token || null;

  const payload = decodeJwt(activeToken);

  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?.id ||
    user?.theatre?._id ||
    user?.theater?.id ||
    user?.theater?._id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);
  const logoFileRef = useRef(null);

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
        // try multiple endpoints in order
        const res =
          (await api.get(`/theatre/me`).catch(() => null)) ||
          (await api.get(`/theatre/${theatreId}`).catch(() => null)) ||
          (await api.get(`/admin/theaters/${theatreId}`).catch(() => null));

        const payload =
          res?.data?.theatre ||
          res?.data?.theater ||
          res?.data ||
          null;

        if (!mounted) return;
        setTheatre(payload);
        setLogoPreview(payload?.logo || payload?.logoUrl || null);
      } catch (e) {
        console.error("Failed to load theatre profile", e?.response || e);
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

  // Guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;

  const validate = () => {
    const errors = {};
    if (!theatre?.name || !String(theatre.name).trim()) errors.name = "Theatre name is required.";
    if (!theatre?.city || !String(theatre.city).trim()) errors.city = "City is required.";
    // address optional but if present minimum length
    if (theatre?.address && String(theatre.address).trim().length < 5)
      errors.address = "Please enter a fuller address.";
    return errors;
  };

  const onLogoChange = (file) => {
    if (!file) {
      setLogoPreview(null);
      logoFileRef.current = null;
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setErr("Logo must be PNG/JPEG/WEBP.");
      return;
    }
    // preview
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
    logoFileRef.current = file;
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
    setFieldErrors({});
    setSaving(true);

    // optimistic copy
    const prev = { ...theatre };

    try {
      // If a logo file was selected, try multipart upload first (some backends accept it)
      if (logoFileRef.current) {
        try {
          const fd = new FormData();
          fd.append("logo", logoFileRef.current);
          // also attach JSON fields as part of form for servers that expect both
          fd.append("meta", JSON.stringify({ name: theatre.name, city: theatre.city, address: theatre.address }));
          await api.put("/theatre/me/logo", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (logoErr) {
          // try fallback to single endpoint that accepts form for theatre
          try {
            const fd2 = new FormData();
            fd2.append("logo", logoFileRef.current);
            await api.put(`/theatre/${theatreId}/logo`, fd2, { headers: { "Content-Type": "multipart/form-data" } });
          } catch (logoErr2) {
            // swallow — we'll still attempt JSON PUT below
            console.warn("Logo upload failed or unsupported; falling back to JSON update", logoErr, logoErr2);
          }
        }
      }

      // Try JSON PUT to update theatre (primary path)
      try {
        await api.put(`/theatre/me`, theatre);
      } catch (e) {
        // try alternate endpoints
        try {
          await api.put(`/theatre/${theatreId}`, theatre);
        } catch (e2) {
          await api.put(`/admin/theaters/${theatreId}`, theatre);
        }
      }

      // Refresh profile in context (if available)
      if (typeof refreshProfile === "function") {
        try {
          await refreshProfile();
        } catch {}
      }

      setMsg("Updated successfully.");
    } catch (e) {
      console.error("Save error:", e?.response || e);
      setErr(e?.response?.data?.message || "Failed to update theatre. Try again.");
      // rollback if needed
      setTheatre(prev);
    } finally {
      setSaving(false);
    }
  }, [theatre, theatreId, refreshProfile]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Card role="status" aria-live="polite">
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse" />
          </div>
        </Card>
      </main>
    );
  }

  if (err && !theatre) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Card role="alert" aria-live="assertive" className="text-rose-700">
          {err}
        </Card>
      </main>
    );
  }

  if (!theatre) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <Card>
          <p className="text-sm text-slate-600">No theatre found for your account.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Theatre Profile</h1>

      <Card>
        <div className="space-y-4">
          {msg && (
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700" role="status" aria-live="polite">
              {msg}
            </div>
          )}
          {err && (
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-700" role="alert" aria-live="assertive">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-3">
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
            </div>

            <div className="space-y-3 flex flex-col items-start">
              <label className="block text-sm font-medium text-slate-700">Logo</label>
              <div className="w-full flex flex-col items-start gap-2">
                <div className="w-36 h-20 bg-slate-50 border rounded flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo preview" className="object-contain w-full h-full" />
                  ) : (
                    <div className="text-xs text-slate-400">No logo</div>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onLogoChange(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    logoFileRef.current = null;
                  }}
                  className="text-sm text-[#0654BA] underline"
                >
                  Remove logo preview
                </button>
              </div>
            </div>
          </div>

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
                // reload profile
                setLoading(true);
                setErr("");
                try {
                  const res = (await api.get(`/theatre/me`).catch(() => null)) || (await api.get(`/theatre/${theatreId}`).catch(() => null));
                  const payload = res?.data?.theatre || res?.data || null;
                  setTheatre(payload);
                  setLogoPreview(payload?.logo || payload?.logoUrl || null);
                  setMsg("Reloaded.");
                  setTimeout(() => setMsg(""), 1800);
                } catch (e) {
                  setErr("Failed to reload profile.");
                } finally {
                  setLoading(false);
                }
              }}
              className="text-sm text-[#0654BA] underline disabled:opacity-60"
            >
              Reload
            </button>
          </div>
        </div>
      </Card>
    </main>
  );
}
