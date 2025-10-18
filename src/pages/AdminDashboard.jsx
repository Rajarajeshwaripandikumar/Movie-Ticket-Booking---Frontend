// src/pages/AdminDashboard.jsx — Walmart-style (clean, rounded, blue accents)
import { Link } from "react-router-dom";
import {
  Building2, // Theaters
  Monitor, // Screens
  CalendarClock, // Showtimes
  CircleDollarSign, // Pricing
  BarChart3, // Analytics
  Clapperboard, // Movies
  ChevronRight,
  ShoppingBag, // Bookings
  Users, // Users
  Bell, // Notifications
  CreditCard, // Payments
  Settings, // System Settings
  FileText, // Reports
} from "lucide-react";

/* ----------------------------- Walmart primitives ---------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

const Tile = ({ to, icon: Icon, label, desc }) => (
  <Link to={to} className="block focus:outline-none group">
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

export default function AdminDashboard() {
  const links = [
    { to: "/admin/theaters", label: "Manage Theaters", desc: "Add or edit theaters", icon: Building2 },
    { to: "/admin/movies", label: "Manage Movies", desc: "Add or edit movie listings", icon: Clapperboard },
    { to: "/admin/screens", label: "Manage Screens", desc: "Add screens under theaters", icon: Monitor },
    { to: "/admin/showtimes", label: "Manage Showtimes", desc: "Schedule movie showtimes", icon: CalendarClock },
    { to: "/admin/pricing", label: "Update Pricing", desc: "Adjust ticket pricing", icon: CircleDollarSign },
    { to: "/admin/analytics", label: "Admin Analytics", desc: "Sales and booking reports", icon: BarChart3 },

    // Additional helpful admin tiles
    { to: "/admin/bookings", label: "Manage Bookings", desc: "View and manage bookings", icon: ShoppingBag },
    { to: "/admin/users", label: "Manage Users", desc: "User accounts, roles & permissions", icon: Users },
    { to: "/admin/notifications", label: "Notifications", desc: "Send announcements & alerts", icon: Bell },
    { to: "/admin/payments", label: "Payments", desc: "Monitor payments and refunds", icon: CreditCard },
    { to: "/admin/settings", label: "System Settings", desc: "Configure app preferences", icon: Settings },
    { to: "/admin/reports", label: "Reports", desc: "Export advanced reports", icon: FileText },
  ];

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
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((l) => (
            <Tile key={l.to} to={l.to} icon={l.icon} label={l.label} desc={l.desc} />
          ))}
        </div>
      </section>
    </main>
  );
}
