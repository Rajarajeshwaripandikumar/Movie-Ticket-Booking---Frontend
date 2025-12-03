// src/pages/ProfilePage.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

/* --------------------------- Walmart primitives --------------------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";

const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const SectionLabel = ({ children }) => (
  <div className="px-1 pt-1 pb-0.5 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
    {children}
  </div>
);

function Field({ type = "text", icon, placeholder, value, onChange, autoFocus }) {
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      {icon ? <span className="text-slate-600">{icon}</span> : null}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
        autoFocus={autoFocus}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase text-slate-600 mb-1">
        {label}
      </div>
      <div className="border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, text }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && onChange(!checked)
        }
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-10 items-center rounded-full border border-slate-300 transition
          ${checked ? "bg-[#0071DC]" : "bg-white"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition
            ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
      <span className="text-sm font-medium text-slate-800">{text}</span>
    </label>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[${BLUE}] hover:bg-[${BLUE_DARK}] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] disabled:opacity-60 ${className}`}
      style={{ backgroundColor: BLUE }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BLUE_DARK)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BLUE)}
      {...props}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold border border-slate-300 bg-white hover:bg-slate-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const Pill = ({ children, className = "" }) => (
  <span
    className={`inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ${className}`}
  >
    {children}
  </span>
);

const Badge = ({ children, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  );
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-end md:items-center justify-center p-3 md:p-6">
        <Card className="w-full md:w-[520px] overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-full px-3 py-1.5 font-semibold border border-slate-300 bg-white hover:bg-slate-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="p-4 sm:p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Inline icons ------------------------------ */
const ic = "w-5 h-5 text-slate-600";
const IconUser = () => (
  <svg
    viewBox="0 0 24 24"
    className={ic}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);
const IconPhone = () => (
  <svg
    viewBox="0 0 24 24"
    className={ic}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.15 9.81 19.8 19.8 0 0 1 .08 1.18 2 2 0 0 1 2.06-.99h2a2 2 0 0 1 2 1.72c.12.9.33 1.78.61 2.62a2 2 0 0 1-.45 2.11L5.4 7.4a16 16 0 0 0 6.2 6.2l1.94-1.83a2 2 0 0 1 2.11-.45c.84.28 1.72.49 2.62.61a2 2 0 0 1 1.72 2v0" />
  </svg>
);
const IconLock = () => (
  <svg
    viewBox="0 0 24 24"
    className={ic}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconTicket = () => (
  <svg
    viewBox="0 0 24 24"
    className={ic}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z" />
    <path d="M9 6v12M15 6v12" opacity=".55" />
  </svg>
);
const IconChevron = () => (
  <svg
    viewBox="0 0 20 20"
    className="w-4 h-4 text-slate-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7.5 4.5L12 10l-4.5 5.5" />
  </svg>
);
const IconArrow = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

/* --------------------------------- Page --------------------------------- */
export default function ProfilePage() {
  const { user, setUser, role } = useAuth() || {};
  const navigate = useNavigate();

  // redirect ANY admin role to admin profile page
  useEffect(() => {
    const r = String(role || "").toUpperCase();
    if (r && r !== "USER") {
      navigate("/admin/profile", { replace: true });
    }
  }, [role, navigate]);

  // state
  const [loadingSave, setLoadingSave] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    preferences: {
      language: "en",
      notifications: { email: true, sms: false },
    },
  });

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // password (modal)
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // UI: modals
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* -------- Helpers -------- */
  function getCreatedAtFromUser(u) {
    if (!u) return null;
    if (u.createdAt) {
      const d = new Date(u.createdAt);
      return isNaN(d) ? null : d;
    }
    const id = (u.id || u._id || "").toString();
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      const seconds = parseInt(id.slice(0, 8), 16);
      return new Date(seconds * 1000);
    }
    return null;
  }

  function formatMemberSinceSafe(u) {
    const d = getCreatedAtFromUser(u);
    return d
      ? d.toLocaleDateString("en-IN", { dateStyle: "medium" })
      : "—";
  }

  function validatePhone(phone) {
    if (!phone) return true;
    const cleaned = String(phone).replace(/\D/g, "");
    return cleaned.length >= 7 && cleaned.length <= 15;
  }

  function deepMergePreferences(curr, patch) {
    const base =
      curr || { language: "en", notifications: { email: true, sms: false } };
    return {
      ...base,
      ...patch,
      notifications: {
        ...base.notifications,
        ...(patch?.notifications || {}),
      },
    };
  }

  const initials = (name = "") =>
    name
      .trim()
      .split(/\s+/, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "U";

  /* Fetch profile & bookings once */
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const ac = new AbortController();
    (async () => {
      try {
        const meRes = await api.get("/profile/me", { signal: ac.signal });
        const u0 = meRes?.data?.user || meRes?.data;
        if (u0) {
          const derived = getCreatedAtFromUser(u0);
          const u = derived ? { ...u0, createdAt: derived } : u0;

          setUser((prev) => {
            if (!prev) return u;
            const same =
              (prev._id || prev.id) === (u._id || u.id) &&
              prev.name === u.name &&
              prev.email === u.email &&
              prev.phone === u.phone &&
              JSON.stringify(prev.preferences || {}) ===
                JSON.stringify(u.preferences || {});
            return same
              ? { ...prev, createdAt: u.createdAt || prev.createdAt }
              : u;
          });
          localStorage.setItem("user", JSON.stringify(u));
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          return navigate("/login", { replace: true });
        }
        console.error("Profile fetch error:", e);
      }

      try {
        setLoadingBookings(true);
        const r = await api.get("/bookings/me", { signal: ac.signal });
        const d = r?.data ?? {};
        const list = Array.isArray(d)
          ? d
          : Array.isArray(d.bookings)
          ? d.bookings
          : [];
        setBookings(list);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.error("Bookings fetch error:", e);
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Seed form when user changes */
  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      preferences:
        user.preferences || {
          language: "en",
          notifications: { email: true, sms: false },
        },
    });
  }, [user?._id, user?.name, user?.phone, user?.preferences]);

  /* Save profile (from modal) */
  async function handleSave(e) {
    e?.preventDefault();
    setErr("");
    setMsg("");

    if (!validatePhone(form.phone)) {
      setErr("Please enter a valid phone number (7–15 digits).");
      return;
    }
    setLoadingSave(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        preferences: deepMergePreferences(user?.preferences, form.preferences),
      };
      await api.put("/profile", payload);

      const refreshed = await api.get("/profile/me");
      const updatedUser0 = refreshed?.data?.user || refreshed?.data;
      if (updatedUser0) {
        const derived = getCreatedAtFromUser(updatedUser0);
        const updatedUser = derived
          ? { ...updatedUser0, createdAt: derived }
          : updatedUser0;

        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setForm({
          name: updatedUser.name || "",
          phone: updatedUser.phone || "",
          preferences:
            updatedUser.preferences || {
              language: "en",
              notifications: { email: true, sms: false },
            },
        });
      }
      setMsg("Profile saved successfully!");
      setShowEdit(false);
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return navigate("/login", { replace: true });
      }
      console.error("Save profile error:", error);
      setErr(error?.response?.data?.message || "Failed to save profile");
    } finally {
      setLoadingSave(false);
    }
  }

  /* Change password (from modal) */
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwErr("");
    setPwMsg("");

    if (!pwCurrent || !pwNew) {
      return setPwErr("Please fill current and new password.");
    }
    if (pwNew.length < 8) {
      return setPwErr("New password should be at least 8 characters.");
    }
    if (pwNew !== pwConfirm) {
      return setPwErr("New password and confirm do not match.");
    }

    setPwLoading(true);
    try {
      // IMPORTANT: backend route is /api/auth/change-password
      const res = await api.post("/auth/change-password", {
        currentPassword: pwCurrent,
        newPassword: pwNew,
      });

      setPwMsg(
        res?.data?.message ||
          "Password changed successfully! Please log in again."
      );

      // clear form fields
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");

      // force re-login
      setTimeout(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return navigate("/login", { replace: true });
      }
      console.error("Change password error:", err);
      setPwErr(
        err?.response?.data?.message || "Failed to change password"
      );
    } finally {
      setPwLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login", { replace: true });
  }

  /* Render (logged-out gate) */
  if (!user) {
    return (
      <div className="min-h-[60vh] w-full [margin-inline:calc(50%-50vw)] bg-slate-50 flex items-center justify-center px-6">
        <Card className="max-w-md w-full p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-extrabold">Please log in</h2>
          <p className="text-sm text-slate-600 mt-2">
            You must be logged in to view this page.
          </p>
        </Card>
      </div>
    );
  }

  /* ------------------------------ Main layout ------------------------------ */
  return (
    <div className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Header card */}
        <Card className="max-w-3xl mx-auto p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Your Profile
            </h1>
            <Pill>USER</Pill>
          </div>

          <div className="mt-4 grid grid-cols-[auto,1fr] gap-4 sm:gap-5 items-center">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border border-slate-200 grid place-items-center bg-white shadow-sm text-xl sm:text-2xl font-extrabold">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold truncate">
                {user?.name || "User"}
              </div>
              <div className="text-sm text-slate-600 truncate">
                {user?.phone || user?.email || "—"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Member since{" "}
                <Badge tone="slate">
                  {formatMemberSinceSafe(user)}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Actions / rows */}
        <div className="max-w-3xl mx-auto grid gap-4">
          {msg && (
            <Card className="p-3 font-semibold bg-emerald-50 border-emerald-200 text-emerald-700">
              {msg}
            </Card>
          )}
          {err && (
            <Card className="p-3 font-semibold bg-rose-50 border-rose-200 text-rose-700">
              {err}
            </Card>
          )}

          <Row
            icon={<IconTicket />}
            label="View all bookings"
            helper={
              loadingBookings
                ? "Loading..."
                : bookings.length
                ? `${bookings.length} total`
                : "No bookings yet"
            }
            onClick={() => navigate("/bookings")}
          />

          <SectionLabel>Profile</SectionLabel>
          <Row
            icon={<IconUser />}
            label="Edit profile"
            onClick={() => setShowEdit(true)}
          />
          <Row
            icon={<IconLock />}
            label="Change password"
            onClick={() => setShowPassword(true)}
          />

          <SectionLabel>Account</SectionLabel>
          <Row
            icon={<span className="w-5 h-5 text-slate-600">↩</span>}
            label="Logout"
            onClick={logout}
            hideChevron
          />
        </div>
      </div>

      {/* -------------------------- Edit Profile Modal -------------------------- */}
      {showEdit && (
        <Modal title="Edit profile" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <Field
              icon={<IconUser />}
              placeholder="Your name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              autoFocus
            />
            <Field
              icon={<IconPhone />}
              type="tel"
              placeholder="e.g. +91-9876543210"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Language"
                value={form.preferences?.language || "en"}
                onChange={(v) =>
                  setForm({
                    ...form,
                    preferences: { ...(form.preferences || {}), language: v },
                  })
                }
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिन्दी" },
                  { value: "mr", label: "मराठी" },
                  { value: "ta", label: "தமிழ்" },
                ]}
              />
              <div className="space-y-2">
                <div className="text-[12px] font-semibold uppercase text-slate-600">
                  Notifications
                </div>
                <Toggle
                  checked={!!form.preferences?.notifications?.email}
                  onChange={(checked) =>
                    setForm({
                      ...form,
                      preferences: {
                        ...(form.preferences || {}),
                        notifications: {
                          ...(form.preferences?.notifications || {}),
                          email: checked,
                        },
                      },
                    })
                  }
                  text="Email"
                />
                <Toggle
                  checked={!!form.preferences?.notifications?.sms}
                  onChange={(checked) =>
                    setForm({
                      ...form,
                      preferences: {
                        ...(form.preferences || {}),
                        notifications: {
                          ...(form.preferences?.notifications || {}),
                          sms: checked,
                        },
                      },
                    })
                  }
                  text="SMS"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <GhostBtn type="button" onClick={() => setShowEdit(false)}>
                Cancel
              </GhostBtn>
              <PrimaryBtn type="submit" disabled={loadingSave}>
                {loadingSave ? "Saving..." : "Save changes"} <IconArrow />
              </PrimaryBtn>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------ Change Password Modal ------------------------ */}
      {showPassword && (
        <Modal
          title="Change password"
          onClose={() => setShowPassword(false)}
        >
          {pwMsg && (
            <Card className="mb-3 p-3 bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold">
              {pwMsg}
            </Card>
          )}
          {pwErr && (
            <Card className="mb-3 p-3 bg-rose-50 border-rose-200 text-rose-700 font-semibold">
              {pwErr}
            </Card>
          )}
          <form
            onSubmit={handleChangePassword}
            className="space-y-3"
            autoComplete="off"
          >
            <Field
              type="password"
              placeholder="Current password"
              value={pwCurrent}
              onChange={setPwCurrent}
            />
            <Field
              type="password"
              placeholder="New password (min 8 chars)"
              value={pwNew}
              onChange={setPwNew}
            />
            <Field
              type="password"
              placeholder="Confirm new password"
              value={pwConfirm}
              onChange={setPwConfirm}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <GhostBtn
                type="button"
                onClick={() => {
                  setPwCurrent("");
                  setPwNew("");
                  setPwConfirm("");
                  setPwErr("");
                  setPwMsg("");
                  setShowPassword(false);
                }}
              >
                Cancel
              </GhostBtn>
              <PrimaryBtn disabled={pwLoading}>
                {pwLoading ? "Changing..." : "Change password"} <IconArrow />
              </PrimaryBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------- Row item -------------------------------- */
function Row({ icon, label, helper, onClick, hideChevron }) {
  return (
    <button onClick={onClick} className="text-left w-full">
      <Card className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-lg p-2 bg-slate-100 text-slate-700 border border-slate-200">
            {icon}
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">{label}</div>
            {helper ? (
              <div className="text-[12px] text-slate-600 mt-0.5">
                {helper}
              </div>
            ) : null}
          </div>
        </div>
        {!hideChevron ? (
          <div className="rounded-md p-1 bg-white border border-slate-200">
            <IconChevron />
          </div>
        ) : (
          <span />
        )}
      </Card>
    </button>
  );
}
