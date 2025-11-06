// src/layouts/AdminShell.jsx
import { Link, NavLink, useNavigate } from "react-router-dom";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Clapperboard,
  Monitor,
  CalendarClock,
  BarChart3,
  LogOut,
  UserCircle,
} from "lucide-react";

export default function AdminShell({ children }) {
  useSSE();
  const navigate = useNavigate();
  const { isTheatreAdmin, isSuperAdmin, logout, user } = useAuth() || {};

  const menu = isSuperAdmin
    ? [
        { to: "/admin/dashboard", icon: BarChart3, label: "Dashboard" },
        { to: "/admin/theatres", icon: Building2, label: "Theatres" },
        { to: "/admin/movies", icon: Clapperboard, label: "Movies" },
        { to: "/admin/showtimes", icon: CalendarClock, label: "Showtimes" },
        { to: "/admin/screens", icon: Monitor, label: "Screens" },
        { to: "/admin/reports", icon: BarChart3, label: "Reports" },
      ]
    : [
        // ✅ Theatre Admin Menu
        { to: "/theatre/dashboard", icon: BarChart3, label: "Dashboard" },
        { to: "/theatre/profile", icon: UserCircle, label: "My Theatre" },
        { to: "/theatre/screens", icon: Monitor, label: "Screens" },
        { to: "/theatre/showtimes", icon: CalendarClock, label: "Showtimes" },
        { to: "/theatre/reports", icon: BarChart3, label: "Reports" },
      ];

  function doLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 font-extrabold text-lg text-[#111827] tracking-tight">
          🎬 Cinema Admin
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {menu.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? "bg-[#0071DC] text-white"
                    : "hover:bg-slate-100 text-slate-700"
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 text-sm text-slate-500 mb-2">
            {user?.name || user?.email || "Admin"}
          </div>
          <button
            onClick={doLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm text-rose-700 hover:bg-rose-50 border border-rose-200"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
