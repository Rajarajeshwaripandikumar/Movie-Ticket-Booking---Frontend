// src/pages/super/CreateTheatreAdmin.jsx — polished (District / Walmart style)
import React, { useState } from "react";
import api from "../../api/api";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(String(id || "").trim());
}

export default function CreateTheatreAdmin() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    theatreId: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.email.trim() || !isValidEmail(form.email))
      errs.email = "Enter a valid email.";
    if (!form.password || form.password.length < 6)
      errs.password = "Password must be ≥ 6 characters.";
    if (form.theatreId && !isValidObjectId(form.theatreId))
      errs.theatreId = "Theatre ID must be a 24-char ObjectId or empty.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault();

    // reset messages
    setMsg("");
    setMsgType("info");

    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        theatreId: form.theatreId?.trim() || undefined,
      };

      const res = await api.post("/superadmin/create-theatre-admin", payload);

      setMsg(res?.data?.message || "Created theatre admin successfully.");
      setMsgType("success");
      setForm({ name: "", email: "", password: "", theatreId: "" });
      setErrors({});

      // auto-clear ONLY success/info messages
      setTimeout(() => {
        setMsg("");
      }, 3500);
    } catch (err) {
      console.error("create theatre admin error", err?.response || err);
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create theatre admin.";
      setMsg(`${code ? code + ": " : ""}${message}`);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6">
      <div className="max-w-md mx-auto">
        <Card>
          <h1 className="text-xl font-extrabold mb-2">Create Theatre Admin</h1>
          <p className="text-sm text-slate-600 mb-4">
            Create an admin account scoped to a theatre (optional).
          </p>

          <form
            onSubmit={submit}
            className="space-y-3"
            aria-label="Create theatre admin form"
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                className={`w-full mt-1 px-3 py-2 rounded-xl text-sm border ${
                  errors.name ? "border-rose-300" : "border-slate-300"
                }`}
                placeholder="Full name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "err-name" : undefined}
              />
              {errors.name && (
                <div id="err-name" className="text-xs text-rose-700 mt-1">
                  {errors.name}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                className={`w-full mt-1 px-3 py-2 rounded-xl text-sm border ${
                  errors.email ? "border-rose-300" : "border-slate-300"
                }`}
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "err-email" : undefined}
              />
              {errors.email && (
                <div id="err-email" className="text-xs text-rose-700 mt-1">
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                className={`w-full mt-1 px-3 py-2 rounded-xl text-sm border ${
                  errors.password ? "border-rose-300" : "border-slate-300"
                }`}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "err-password" : undefined}
              />
              {errors.password && (
                <div
                  id="err-password"
                  className="text-xs text-rose-700 mt-1"
                >
                  {errors.password}
                </div>
              )}
            </div>

            {/* Theatre ID (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Theatre ID (optional)
              </label>
              <input
                className={`w-full mt-1 px-3 py-2 rounded-xl text-sm border ${
                  errors.theatreId ? "border-rose-300" : "border-slate-300"
                }`}
                placeholder="24-character ObjectId"
                value={form.theatreId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, theatreId: e.target.value }))
                }
                aria-invalid={!!errors.theatreId}
                aria-describedby={
                  errors.theatreId ? "err-theatreId" : undefined
                }
              />
              {errors.theatreId && (
                <div
                  id="err-theatreId"
                  className="text-xs text-rose-700 mt-1"
                >
                  {errors.theatreId}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Creating…" : "Create"}
              </button>
            </div>

            {/* Message banner */}
            {msg && (
              <div
                role={msgType === "error" ? "alert" : "status"}
                className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                  msgType === "error"
                    ? "bg-rose-50 border border-rose-200 text-rose-700"
                    : msgType === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-blue-50 border border-blue-200 text-blue-700"
                }`}
              >
                {msg}
              </div>
            )}
          </form>
        </Card>
      </div>
    </main>
  );
}
