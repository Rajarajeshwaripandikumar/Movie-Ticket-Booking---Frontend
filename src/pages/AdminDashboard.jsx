// src/pages/AdminDashboard.jsx — Walmart-style (clean, rounded, blue accents)
// Full file (updated): resilient theaters fetch + robust create-theatre-admin fallback + debug logging

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,        // Theaters
  Monitor,          // Screens
  CalendarClock,    // Showtimes
  CircleDollarSign, // Pricing
  BarChart3,        // Analytics
  Clapperboard,     // Movies
  ChevronRight,
  UserPlus,
} from "lucide-react";
import api, { getAuthFromStorage } from "../api/api";
import { useAuth } from "../context/AuthContext";

/* ----------------------------- Endpoint candidates ----------------------------- */
/* We try several likely endpoints (covers spelling and admin variants) */
const THEATERS_CANDIDATES = [
  "/theaters",
  "/theatres",
  "/admin/theaters",
  "/admin/theatres",
  "/superadmin/theaters",
  "/superadmin/theatres",
  "/theaters/mine",
  "/theatres/mine",
];

const CREATE_THEATRE_ADMIN_CANDIDATES = [
  "/superadmin/theatre-admins",
  "/super/theatre-admins",
  "/superadmin/theatre-admins",
  "/admin/theatre-admins",
  "/super/theatre-admins",
];

/* ----------------------------- Walmart primitives ---------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

// Simple Link (no preventDefault/navigate) to avoid routing quirks
const Tile = ({ to, icon: Icon, label, desc, disabled = false }) => {
  return (
    <Link
      to={to}
      aria-disabled={disabled}
      className={`block focus:outline-none group ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <Card className="p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0654BA]">
              {label}
            </h3>
            <p className="text-sm text-slate-600 mt-1">{desc}</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
              <Icon className="h-5 w-5 text-[#0071DC]" aria-hidden="true" />
            </span>
            <span className="inline-grid place-items-center h-8 w-8 rounded-lg border border-slate-200 bg-white group-hover:bg-slate-50">
              <ChevronRight className="h-4 w-4 text-slate-700" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
};

/* ----------------------------- helpers (network resilience) ---------------------------- */

/**
 * Try candidate theater list endpoints until one returns data (or empty array).
 * Returns the first array found (possibly empty), or throws if none succeed.
 * Accepts optional AbortController.signal to cancel requests.
 */
async function fetchTheatersWithFallback(signal) {
  let lastErr = null;
  for (const path of THEATERS_CANDIDATES) {
    try {
      // use getFresh semantics by appending _ts param to avoid stale caches
      const res = await api.get(path, { params: { _ts: Date.now() }, signal });
      const payload = res?.data;
      const list =
        (Array.isArray(payload) && payload) ||
        payload?.data ||
        payload?.theaters ||
        payload?.items ||
        payload?.results ||
        payload?.theatres ||
        [];
      if (Array.isArray(list)) {
        console.info("[AdminDashboard] theater endpoint succeeded:", path, "count:", list.length);
        return list;
      }
      // otherwise keep trying
    } catch (err) {
      lastErr = err;
      console.debug("[AdminDashboard] theater endpoint failed:", path, err?.response?.status || err?.message || err);
      // continue to next candidate
      if (err?.name === "AbortError") {
        // propagate abort immediately
        throw err;
      }
    }
  }
  // none succeeded
  throw lastErr || new Error("No theater endpoint available");
}

/**
 * Try candidate create-theatre-admin endpoints until one succeeds.
 * Returns axios response or throws last error.
 * Accepts optional signal to cancel.
 */
async function tryCreateTheatreAdmin(payload, signal) {
  let lastErr = null;
  for (const path of CREATE_THEATRE_ADMIN_CANDIDATES) {
    try {
      const res = await api.post(path, payload, { signal });
      console.info("[AdminDashboard] create theatre-admin succeeded:", path);
      return res;
    } catch (err) {
      lastErr = err;
      console.debug("[AdminDashboard] create theatre-admin failed at", path, err?.response?.status || err?.message || err);
      if (err?.name === "AbortError") {
        throw err;
      }
      // try next
    }
  }
  throw lastErr || new Error("Create theatre admin failed for all candidate endpoints");
}

/* --------------------------------- Page --------------------------------- */
export default function AdminDashboard() {
  const { isSuperAdmin, isAdmin, isTheatreAdmin } = useAuth() || {};

  // Role gates must mirror your App.jsx route guards
  const canScreens   = isSuperAdmin || isAdmin || isTheatreAdmin; // /admin/screens
  const canShowtimes = isSuperAdmin || isTheatreAdmin;            // /admin/showtimes
  const canTheaters  = isSuperAdmin;                              // /admin/theaters
  const canMovies    = isSuperAdmin;                              // /admin/movies
  const canPricing   = isSuperAdmin || isTheatreAdmin;            // /admin/pricing
  const canAnalytics = isSuperAdmin;                              // /admin/analytics

  const links = [
    { to: "/admin/theaters",  label: "Manage Theaters",  desc: "Add or edit theaters",        icon: Building2,       show: canTheaters },
    { to: "/admin/movies",    label: "Manage Movies",    desc: "Add or edit movie listings",  icon: Clapperboard,    show: canMovies },
    { to: "/admin/screens",   label: "Manage Screens",   desc: "Add screens under theaters",  icon: Monitor,         show: canScreens },
    { to: "/admin/showtimes", label: "Manage Showtimes", desc: "Schedule movie showtimes",    icon: CalendarClock,   show: canShowtimes },
    { to: "/admin/pricing",   label: "Update Pricing",   desc: "Adjust ticket pricing",       icon: CircleDollarSign,show: canPricing },
    { to: "/admin/analytics", label: "Admin Analytics",  desc: "Sales and booking reports",   icon: BarChart3,       show: canAnalytics },
  ];

  // Theatre list for the form (SUPER_ADMIN only; hidden otherwise)
  const [theatres, setTheatres] = useState([]);
  const [loadingTheatres, setLoadingTheatres] = useState(true);

  // Create theatre admin form state
  const [aName, setAName] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aPassword, setAPassword] = useState("");
  const [aTheatreId, setATheatreId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "success" | "error", text: string }

  // Prime axios auth from storage once (extra safety for admin flows)
  useEffect(() => {
    try {
      const auth = getAuthFromStorage?.() || getAuthFromStorage?.(); // defensive
      if (auth && auth.token) api.setAuthToken(auth.token);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      setLoadingTheatres(true);
      setMsg(null);
      try {
        const list = await fetchTheatersWithFallback(ac.signal);
        if (!mounted) return;
        // normalize each theatre to shape { id, name, city } safely
        const normalized = (Array.isArray(list) ? list : []).map((t, idx) => ({
          _id: t._id ?? t.id ?? `${idx}`,
          name: (t.name || t.title || t.theatreName || t.theater_name || "Unknown").toString(),
          city: (t.city || t.town || t.location || "").toString(),
        }));
        if (mounted) setTheatres(normalized);
      } catch (err) {
        if (err?.name === "AbortError") {
          // aborted — ignore
          return;
        }
        console.error("[AdminDashboard] Failed to load theaters:", err?.response?.status || err?.message || err);
        if (mounted) {
          setTheatres([]);
          setMsg({ type: "error", text: "Failed to load theatres — check API or your role." });
        }
      } finally {
        if (mounted) setLoadingTheatres(false);
      }
    })();

    return () => {
      mounted = false;
      try { ac.abort(); } catch {}
    };
    // rerun when auth flags change so UI reflects permissions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, isAdmin, isTheatreAdmin]);

  const resetForm = () => {
    setAName("");
    setAEmail("");
    setAPassword("");
    setATheatreId("");
    setMsg(null);
  };

  const handleCreateTheatreAdmin = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!aName.trim() || !aEmail.trim() || !aPassword || !aTheatreId) {
      setMsg({ type: "error", text: "Please fill all required fields." });
      return;
    }

    setBusy(true);
    const ac = new AbortController();
    try {
      await tryCreateTheatreAdmin({
        name: aName.trim(),
        email: aEmail.trim(),
        password: aPassword,
        theatreId: aTheatreId,
      }, ac.signal);

      setMsg({ type: "success", text: "Theatre admin created successfully." });
      resetForm();
      // refresh theaters list in case backend linked changes
      try {
        const list = await fetchTheatersWithFallback();
        const normalized = (Array.isArray(list) ? list : []).map((t, idx) => ({
          _id: t._id ?? t.id ?? `${idx}`,
          name: (t.name || t.title || t.theatreName || t.theater_name || "Unknown").toString(),
          city: (t.city || t.town || t.location || "").toString(),
        }));
        setTheatres(normalized);
      } catch (e) {
        // ignore refresh errors
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setMsg({ type: "error", text: "Request cancelled." });
      } else {
        const status = err?.response?.status;
        let text = err?.response?.data?.message || "Failed to create theatre admin.";
        if (status === 409 || /exist/i.test(text)) text = "Email already exists. Try another.";
        console.error("[AdminDashboard] create theatre admin error:", status, text);
        setMsg({ type: "error", text });
      }
    } finally {
      try { ac.abort(); } catch {}
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900">
      {/* Header */}
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <Card className="p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Manage theaters, screens, showtimes, pricing, analytics, and movies.
            </p>
          </Card>
        </div>
      </section>

      {/* Tiles Grid */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.filter(l => l.show).map((l) => (
            <Tile key={l.to} to={l.to} icon={l.icon} label={l.label} desc={l.desc} />
          ))}
        </div>
      </section>

      {/* Create Theatre Admin — SUPER_ADMIN only */}
      {isSuperAdmin && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
          <Card className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-200 bg-sky-50">
                <UserPlus className="h-5 w-5 text-[#0071DC]" />
              </span>
              <div>
                <h2 className="text-lg md:text-xl font-bold">Create Theatre Admin</h2>
                <p className="text-sm text-slate-600">
                  Assign an admin to manage a specific theatre.
                </p>
              </div>
            </div>

            {msg && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  msg.type === "success"
                    ? "border-green-500/60 bg-green-50 text-green-800"
                    : "border-rose-500/60 bg-rose-50 text-rose-800"
                }`}
              >
                {msg.text}
              </div>
            )}

            <form onSubmit={handleCreateTheatreAdmin} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="aName">Admin Name*</label>
                <input
                  id="aName"
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                  placeholder="e.g. PVR Manager"
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="aEmail">Admin Email*</label>
                <input
                  id="aEmail"
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                  placeholder="admin@example.com"
                  value={aEmail}
                  onChange={(e) => setAEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="aPassword">Password*</label>
                <input
                  id="aPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                  placeholder="Strong password"
                  value={aPassword}
                  onChange={(e) => setAPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="aTheatre">Theatre*</label>
                <select
                  id="aTheatre"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                  value={aTheatreId}
                  onChange={(e) => setATheatreId(e.target.value)}
                  required
                >
                  <option value="">
                    {loadingTheatres ? "Loading theatres…" : "Select a theatre…"}
                  </option>
                  {theatres.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}{t.city ? ` — ${t.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0071DC] px-4 py-2 text-white font-semibold hover:bg-[#0654BA] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                >
                  {busy ? "Creating…" : "Create Theatre Admin"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </form>

            <p className="mt-3 text-xs text-slate-600">
              Tip: If you see “Email already exists”, use a different email or delete the existing account.
            </p>
          </Card>
        </section>
      )}
    </main>
  );
}
