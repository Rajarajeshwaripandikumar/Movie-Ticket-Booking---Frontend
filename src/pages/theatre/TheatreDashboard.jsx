// src/pages/theatre/TheatreDashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Monitor, CalendarClock, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 ${className}`}>{children}</div>
);

export default function TheatreDashboard() {
  const { token, user, role } = useAuth();
  const theatreId = user?.theatreId;
  const [stats, setStats] = useState({ screens: 0, upcomingShowtimes: 0, bookings: 0 });
  const [theatre, setTheatre] = useState(null);

  useEffect(() => {
    if (!theatreId || !token) return;
    (async () => {
      try {
        const hdr = { headers: { Authorization: `Bearer ${token}` } };
        // backend endpoints — adapt if needed
        const tRes = await api.get(`/theaters/${theatreId}`, hdr);
        setTheatre(tRes?.data || tRes);

        const screensRes = await api.get(`/theaters/${theatreId}/screens`, hdr);
        const showtimesRes = await api.get(`/showtimes?theatre=${theatreId}&upcoming=true`, hdr);
        const bookingsRes = await api.get(`/admin/reports?theatre=${theatreId}`, hdr); // backend: reports filter
        setStats({
          screens: Array.isArray(screensRes?.data) ? screensRes.data.length : (screensRes?.length || 0),
          upcomingShowtimes: Array.isArray(showtimesRes?.data) ? showtimesRes.data.length : (showtimesRes?.length || 0),
          bookings: bookingsRes?.data?.count ?? (bookingsRes?.count || 0),
        });
      } catch (err) {
        console.error("TheatreDashboard load error", err);
      }
    })();
  }, [theatreId, token]);

  if (role !== "THEATRE_ADMIN") {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-5">
        <Card>
          <h1 className="text-2xl font-extrabold text-[#0071DC]">My Theatre Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">{theatre ? `${theatre.name} — ${theatre.city}` : "Loading theatre..."}</p>
        </Card>

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
