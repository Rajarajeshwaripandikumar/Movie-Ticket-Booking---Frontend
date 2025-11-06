// src/pages/theatre/TheatreDashboard.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Monitor, CalendarClock, BarChart3 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 ${className}`}>{children}</div>
);

/* ------------------------------ helpers ------------------------------ */
const arr = (x) =>
  Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : [];
const firstObj = (x) => (x && typeof x === "object" ? x : null);

/** Try endpoints in order and return the first successful payload */
async function tryFetch(candidates = [], signal) {
  for (const ep of candidates) {
    try {
      const res = await api.get(ep, { signal });
      return res?.data ?? res;
    } catch (e) {
      // If aborted, stop immediately
      if (signal?.aborted) throw e;
      // otherwise try next
    }
  }
  return undefined;
}

export default function TheatreDashboard() {
  const { token, user, isTheatreAdmin } = useAuth() || {};
  const theatreIdFromUser =
    user?.theatreId || user?.theaterId || user?.theatre?.id || user?.theater?.id || "";

  const [stats, setStats] = useState({ screens: 0, upcomingShowtimes: 0, bookings: 0 });
  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // prevent state writes after unmount + avoid redundant updates
  const mountedRef = useRef(false);
  const prevTheatreJson = useRef("");
  const prevStatsJson = useRef("");

  useEffect(() => {
    document.title = "My Theatre | Cinema";
  }, []);

  const loadDashboard = useCallback(
    async (signal) => {
      setErr("");

      /* ---------- load theatre details ---------- */
      // IMPORTANT: prefer /theatre/my (not /theatre/me)
      const tData =
        (await tryFetch(
          [
            "/theatre/my",
            theatreIdFromUser ? `/theaters/${theatreIdFromUser}` : "",
            theatreIdFromUser ? `/admin/theaters/${theatreIdFromUser}` : "",
          ].filter(Boolean),
          signal
        )) || {};

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

      /* ---------- load screens ---------- */
      const sData =
        (await tryFetch(
          [
            "/theatre/screens",
            resolvedTheatreId ? `/theaters/${resolvedTheatreId}/screens` : "",
            resolvedTheatreId ? `/admin/theaters/${resolvedTheatreId}/screens` : "",
          ].filter(Boolean),
          signal
        )) || [];

      const screens = arr(sData);
      const screensCount = screens.length;

      /* ---------- load upcoming showtimes ---------- */
      const stData =
        (await tryFetch(
          [
            "/theatre/showtimes?upcoming=true",
            resolvedTheatreId ? `/showtimes?theatre=${resolvedTheatreId}&upcoming=true` : "",
            resolvedTheatreId ? `/admin/showtimes?theatre=${resolvedTheatreId}&upcoming=true` : "",
          ].filter(Boolean),
          signal
        )) || [];

      const showtimes = arr(stData);
      const upcomingShowtimes = showtimes.length;

      /* ---------- load bookings summary ---------- */
      const bData =
        (await tryFetch(
          [
            "/theatre/reports?summary=true",
            resolvedTheatreId ? `/theatre/reports?theatre=${resolvedTheatreId}&summary=true` : "",
            resolvedTheatreId ? `/admin/reports?theatre=${resolvedTheatreId}&summary=true` : "",
          ].filter(Boolean),
          signal
        )) || {};

      const bookings =
        bData?.count ?? bData?.totalBookings ?? (Array.isArray(bData) ? bData.length : 0);

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
    if (!token || !isTheatreAdmin) return;
    mountedRef.current = true;
    setLoading(true);

    const controller = new AbortController();

    (async () => {
      try {
        await loadDashboard(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error("TheatreDashboard load error", e?.response || e);
          const status = e?.response?.status;
          if (status === 404) {
            // Stop spinner and show a friendly message (no retry loop)
            setTheatre(null);
          } else {
            setErr(e?.response?.data?.message || "Failed to load theatre dashboard.");
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
  }, [token, isTheatreAdmin, loadDashboard]);

  // 🔒 Guard using context boolean to avoid role string mismatch
  if (!token) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-5">
        <Card>
          <h1 className="text-2xl font-extrabold text-[#0071DC]">My Theatre Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            {loading
              ? "Loading theatre..."
              : theatre
              ? `${theatre.name || "—"}${theatre.city ? " — " + theatre.city : ""}`
              : "Theatre not found"}
          </p>
        </Card>

        {err ? (
          <Card className="bg-rose-50 border-rose-200 text-rose-700 font-semibold">{err}</Card>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="text-center">
            <Monitor className="mx-auto h-6 w-6 text-[#0071DC]" />
            <div className="text-xl font-bold mt-2">{stats.screens}</div>
            <div className="text-sm text-slate-600">Screens</div>
          </Card>

          <Card className="text-center">
            <CalendarClock className="mx-auto h-6 w-6 text-[#0071DC]" />
            <div className="text-xl font-bold mt-2">{stats.upcomingShowtimes}</div>
            <div className="text-sm text-slate-600">Upcoming Showtimes</div>
          </Card>

          <Card className="text-center">
            <BarChart3 className="mx-auto h-6 w-6 text-[#0071DC]" />
            <div className="text-xl font-bold mt-2">{stats.bookings}</div>
            <div className="text-sm text-slate-600">Bookings (period)</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/theatre/screens"><Card className="text-center">Manage Screens</Card></Link>
          <Link to="/theatre/showtimes"><Card className="text-center">Manage Showtimes</Card></Link>
          <Link to="/theatre/reports"><Card className="text-center">Reports</Card></Link>
        </div>
      </div>
    </main>
  );
}
