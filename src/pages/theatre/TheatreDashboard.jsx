// src/pages/theatre/TheatreDashboard.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Monitor, CalendarClock, BarChart3, ChevronRight } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

/* ------------------------------ UI primitives ------------------------------ */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const MiniStat = ({ label, value, loading = false }) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1">
    <span className="text-xs font-medium text-slate-500">{label}</span>
    <span className="text-sm font-semibold text-slate-800">
      {loading ? (
        <span className="inline-block h-4 w-6 rounded bg-slate-200 animate-pulse" />
      ) : (
        value ?? "—"
      )}
    </span>
  </div>
);

const ActionTile = ({ to, icon: Icon, title, description, meta }) => (
  <Link to={to} className="block group">
    <Card className="flex items-center justify-between gap-4 hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-[#0071DC]">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
          {meta && (
            <p className="text-xs text-slate-500 mt-1 font-medium">{meta}</p>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-400" />
    </Card>
  </Link>
);

/* ------------------------------ helpers ------------------------------ */
const arr = (x) =>
  Array.isArray(x)
    ? x
    : Array.isArray(x?.items)
    ? x.items
    : Array.isArray(x?.data)
    ? x.data
    : [];

const firstObj = (x) =>
  x && typeof x === "object" && !Array.isArray(x) ? x : null;

function decodeJwt(t) {
  try {
    const payload = String(t ?? "").split(".")[1];
    if (!payload) return {};
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

/** Try endpoints in order and return the first successful payload */
async function tryFetch(candidates = [], signal) {
  for (const ep of candidates) {
    try {
      const res = await api.get(ep, { signal });
      return res?.data ?? res;
    } catch (e) {
      if (signal?.aborted) throw e; // stop immediately if aborted
      // continue to next endpoint candidate
    }
  }
  return undefined;
}

/* -------------------------------- Component -------------------------------- */
export default function TheatreDashboard() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null; // use admin token if present
  const payload = activeToken ? decodeJwt(activeToken) : {};
  const theatreIdFromUser =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?.id ||
    user?.theater?.id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [stats, setStats] = useState({
    screens: 0,
    upcomingShowtimes: 0,
    bookings: 0,
  });
  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // lifecycle refs to avoid state updates after unmount
  const mountedRef = useRef(false);
  const prevTheatreJson = useRef("");
  const prevStatsJson = useRef("");
  const tried404Ref = useRef(false);

  useEffect(() => {
    document.title = "My Theatre | Cinema";
  }, []);

  const loadDashboard = useCallback(
    async (signal) => {
      setErr("");

      // ---------- theatre details ----------
      const theatreCandidates = [
        theatreIdFromUser ? `/theaters/${theatreIdFromUser}` : "",
        theatreIdFromUser ? `/admin/theaters/${theatreIdFromUser}` : "",
        "/theatre/my",
      ].filter(Boolean);

      const tData = (await tryFetch(theatreCandidates, signal)) || {};
      const t =
        firstObj(tData.theatre) ||
        firstObj(tData.theater) ||
        firstObj(tData.data) ||
        firstObj(tData) ||
        null;

      const tJson = JSON.stringify(t ?? {});
      if (prevTheatreJson.current !== tJson) {
        prevTheatreJson.current = tJson;
        if (!signal?.aborted && mountedRef.current) setTheatre(t);
      }

      const resolvedTheatreId =
        theatreIdFromUser || t?._id || t?.id || t?.theatreId || t?.theaterId || "";

      // ---------- screens ----------
      const screensCandidates = [
        resolvedTheatreId ? `/theaters/${resolvedTheatreId}/screens` : "",
        resolvedTheatreId ? `/admin/theaters/${resolvedTheatreId}/screens` : "",
        "/theatre/screens",
      ].filter(Boolean);

      const sData = (await tryFetch(screensCandidates, signal)) || [];
      const screens = arr(sData);
      const screensCount = screens.length;

      // ---------- upcoming showtimes ----------
      const stCandidates = [
        resolvedTheatreId
          ? `/showtimes?theatre=${resolvedTheatreId}&upcoming=true`
          : "",
        resolvedTheatreId
          ? `/admin/showtimes?theatre=${resolvedTheatreId}&upcoming=true`
          : "",
        "/theatre/showtimes?upcoming=true",
      ].filter(Boolean);
      const stData = (await tryFetch(stCandidates, signal)) || [];
      const showtimes = arr(stData);
      const upcomingShowtimes = showtimes.length;

      // ---------- bookings summary (NEW: use /theatre/reports/summary) ----------
      const bCandidates = [
        resolvedTheatreId
          ? `/theatre/reports/summary?theatre=${resolvedTheatreId}`
          : "/theatre/reports/summary",
        // fallback shapes (older APIs) if needed:
        resolvedTheatreId
          ? `/theatre/reports?theatre=${resolvedTheatreId}&summary=true`
          : "",
        "/theatre/reports?summary=true",
      ].filter(Boolean);

      const bData = (await tryFetch(bCandidates, signal)) || {};
      const statsObj = bData?.stats || bData || {};

      const bookings =
        typeof statsObj.totalBookings === "number"
          ? statsObj.totalBookings
          : typeof bData?.count === "number"
          ? bData.count
          : Array.isArray(bData)
          ? bData.length
          : 0;

      const nextStats = { screens: screensCount, upcomingShowtimes, bookings };
      const nextStatsJson = JSON.stringify(nextStats);
      if (prevStatsJson.current !== nextStatsJson) {
        prevStatsJson.current = nextStatsJson;
        if (!signal?.aborted && mountedRef.current) setStats(nextStats);
      }
    },
    [theatreIdFromUser]
  );

  useEffect(() => {
    if (!activeToken || !isTheatreAdmin) return;
    if (tried404Ref.current) {
      setLoading(false);
      return; // don't keep retrying after 404 until reload/navigation
    }

    mountedRef.current = true;
    setLoading(true);
    setErr("");

    const controller = new AbortController();

    (async () => {
      try {
        await loadDashboard(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error("TheatreDashboard load error", e?.response || e);
          const status = e?.response?.status;
          if (status === 404) {
            setTheatre(null);
            tried404Ref.current = true;
          } else {
            setErr(
              e?.response?.data?.message ||
                "Failed to load theatre dashboard."
            );
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [activeToken, isTheatreAdmin, loadDashboard]);

  // Guard: require token and theatre-admin
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-lg text-center p-8">
          <h2 className="text-xl font-semibold text-rose-600">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-600">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  const theatreLine = theatre
    ? `${theatre.name || "—"}${
        theatre.city ? " — " + theatre.city : ""
      }`
    : "Theatre not found";

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Header card – match Admin dashboard style */}
        <Card className="space-y-3">
          <h1 className="text-3xl font-extrabold text-[#0071DC]">
            Theatre Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Manage screens, showtimes, bookings, and reports for your theatre.
          </p>
          <p className="text-sm text-slate-600">
            {loading ? "Loading theatre..." : theatreLine}
          </p>

          {/* compact stats row */}
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniStat
              label="Screens"
              value={stats.screens}
              loading={loading}
            />
            <MiniStat
              label="Upcoming showtimes"
              value={stats.upcomingShowtimes}
              loading={loading}
            />
            <MiniStat
              label="Bookings (period)"
              value={stats.bookings}
              loading={loading}
            />
          </div>
        </Card>

        {err ? (
          <Card className="bg-rose-50 border-rose-200 text-rose-700 font-semibold">
            {err}
          </Card>
        ) : null}

        {/* Action tiles – same feel as Admin dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActionTile
            to="/theatre/screens"
            icon={Monitor}
            title="Manage Screens"
            description="Add or edit screens under your theatre."
            meta={
              !loading
                ? `${stats.screens || 0} ${
                    stats.screens === 1 ? "screen" : "screens"
                  }`
                : ""
            }
          />

          <ActionTile
            to="/theatre/showtimes"
            icon={CalendarClock}
            title="Manage Showtimes"
            description="Schedule and update movie showtimes."
            meta={
              !loading
                ? `${stats.upcomingShowtimes || 0} upcoming showtime${
                    stats.upcomingShowtimes === 1 ? "" : "s"
                  }`
                : ""
            }
          />

          <ActionTile
            to="/theatre/reports"
            icon={BarChart3}
            title="Reports"
            description="View bookings and revenue reports."
            meta={
              !loading
                ? `${stats.bookings || 0} booking${
                    stats.bookings === 1 ? "" : "s"
                  } in period`
                : ""
            }
          />
        </div>

        {/* If theatre missing, show helpful next step */}
        {!loading && !theatre && !err && (
          <Card className="text-center">
            <p className="text-sm text-slate-600 mb-3">
              No theatre record found for your account.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/theatre/create"
                className="inline-block rounded-full px-4 py-2 text-sm font-semibold bg-[#0071DC] text-white"
              >
                Create Theatre
              </Link>
              <Link
                to="/support"
                className="text-sm text-[#0654BA] underline"
              >
                Contact Support
              </Link>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
