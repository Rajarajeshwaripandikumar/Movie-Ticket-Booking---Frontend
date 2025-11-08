// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

/* ---------------- Layout (kept minimal so it's self-contained) ------------- */
function GlobalBackdrop() { return null; }
function Footer() { return <footer className="p-6 text-center text-slate-500">© Cinema</footer>; }

/** Inline admin quick menu so you don't need AdminUserMenu.jsx */
function AdminQuickMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
        onClick={() => setOpen(o => !o)}
      >
        Admin Menu ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-2 min-w-[240px] rounded-xl border bg-white shadow-lg p-2 z-50">
          <nav className="flex flex-col gap-1">
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/profile" onClick={() => setOpen(false)}>Profile</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/theaters" onClick={() => setOpen(false)}>Manage Theaters</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/movies" onClick={() => setOpen(false)}>Manage Movies</Link>
            {/* ✅ absolute link */}
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/screens" onClick={() => setOpen(false)}>Manage Screens</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/showtimes" onClick={() => setOpen(false)}>Manage Showtimes</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/pricing" onClick={() => setOpen(false)}>Update Pricing</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/admin/analytics" onClick={() => setOpen(false)}>Admin Analytics</Link>
            <Link className="px-3 py-2 rounded-lg hover:bg-slate-50" to="/super/theatre-admins" onClick={() => setOpen(false)}>Theatre Admins</Link>
          </nav>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold text-xl">Cinema</Link>
        <AdminQuickMenu />
      </div>
    </header>
  );
}

/* ------------------------------ Pages (stubs) ------------------------------ */
const Page = (t) => () => <div className="p-6"><h1 className="text-2xl font-semibold">{t}</h1></div>;
const Home = Page("Home");
const Login = Page("Login");
const AdminLogin = Page("Admin Login");
const Register = Page("Register");
const Movies = Page("Movies");
const MovieDetail = Page("Movie Detail");
const Showtimes = Page("Showtimes");
const SeatSelection = Page("Seat Selection");
const Checkout = Page("Checkout");
const PaymentPage = Page("Payment");
const TheatersPage = Page("Theaters");
const TicketDetails = Page("Ticket Details");
const ForgotPassword = Page("Forgot Password");
const ResetPassword = Page("Reset Password");
const AccountInfo = Page("Account Info");
const ProfilePage = Page("Profile");
const MyBookings = Page("My Bookings");
const AdminDashboard = Page("Admin Dashboard");
const AdminTheaters = Page("Admin Theaters");
const AdminShowtimes = Page("Admin Showtimes");
const AdminPricing = Page("Admin Pricing");
const AdminMoviesPage = Page("Admin Movies");
const AdminProfile = Page("Admin Profile");
const AdminAnalytics = Page("Admin Analytics");
const AdminBookingDetails = Page("Admin Booking Details");
const TheatreDashboard = Page("Theatre Dashboard");
const TheatreScreens = Page("Theatre Screens");
const TheatreShowtimes = Page("Theatre Showtimes");
const TheatreProfile = Page("Theatre Profile");
const TheatreReports = Page("Theatre Reports");
const TheatrePricing = Page("Theatre Pricing");
const TheatreView = Page("Theatre View");
const TheatreAdmins = Page("Theatre Admins");

/* ------------------------------- Real page -------------------------------- */
function AdminScreens() {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-2xl font-semibold">Manage Screens</h1>
      <p className="text-slate-600">Add screens under theaters.</p>
    </div>
  );
}

/* -------------------------------- Helpers --------------------------------- */
function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}
const normalizeRole = (r) => {
  if (!r) return null;
  let x = String(r).trim().toUpperCase().replace(/\s+/g, "_");
  if (x.startsWith("ROLE_")) x = x.slice(5);
  if (x === "THEATER_ADMIN") x = "THEATRE_ADMIN";
  if (x === "SUPERADMIN") x = "SUPER_ADMIN";
  return x;
};
const inferRole = (auth) => {
  if (!auth) return null;
  if (auth.isSuperAdmin) return "SUPER_ADMIN";
  if (auth.isAdmin) return "ADMIN";
  if (auth.isTheatreAdmin || auth.isTheaterAdmin) return "THEATRE_ADMIN";
  return null;
};

function RequireAuth({ children, role }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth?.loading) return null;

  const roleFromCtx = normalizeRole(auth?.role || auth?.user?.role) || inferRole(auth);
  const roleFromStorage =
    typeof window !== "undefined" ? normalizeRole(localStorage.getItem("role")) : null;
  const currentRole = normalizeRole(roleFromCtx || roleFromStorage);

  const hasSession =
    !!auth?.isAuthenticated ||
    !!auth?.isLoggedIn ||
    !!auth?.adminToken ||
    !!auth?.token ||
    (typeof window !== "undefined" &&
      (localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("jwt")));

  if (!hasSession) {
    const needsAdmin = Array.isArray(role)
      ? role.map(normalizeRole).some((r) => ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(r))
      : ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(normalizeRole(role));
    return <Navigate to={needsAdmin ? "/admin/login" : "/login"} replace state={{ from: location }} />;
  }

  if (!role) return children;

  const allowed = Array.isArray(role) ? role.map(normalizeRole) : [normalizeRole(role)];
  if (currentRole === "SUPER_ADMIN") return children;
  if (currentRole && allowed.includes(currentRole)) return children;

  if (currentRole === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  if (currentRole === "ADMIN") return <Navigate to="/admin/screens" replace />;
  return <Navigate to="/" replace />;
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname, search]);
  return null;
}

function AdminIndex() {
  const auth = useAuth();
  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" && normalizeRole(localStorage.getItem("role")));
  if (role === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  return <Navigate to="/" replace />;
}

function TheatreIndex() { return <Navigate to="/theatre/my" replace />; }

function RedirectIfAdmin({ children }) {
  const auth = useAuth();
  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" && normalizeRole(localStorage.getItem("role")));
  if (role === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  return children;
}

function RoleProfileRouter() {
  const auth = useAuth();
  const r =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" && normalizeRole(localStorage.getItem("role")));
  if (r === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (r === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (r === "THEATRE_ADMIN") return <Navigate to="/theatre/profile" replace />;
  return <Navigate to="/profile" replace />;
}

/* ----------------------------------- App ---------------------------------- */
export default function App() {
  const navigate = useNavigate();

  // Example dashboard tile here (self-contained) to ensure /admin/screens is used
  function AdminDashboardTiles() {
    const Card = ({ title, desc, to }) => (
      <div className="rounded-2xl border bg-white shadow-sm p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-slate-600">{desc}</p>
        <div className="mt-3 flex gap-2">
          <Link to={to} className="inline-flex items-center rounded-xl border px-3 py-2 hover:bg-slate-50">Open</Link>
          <button type="button" onClick={() => navigate(to)} className="inline-flex items-center rounded-xl border px-3 py-2 hover:bg-slate-50">Go</button>
        </div>
      </div>
    );
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Manage Theaters" desc="Add or edit theaters" to="/admin/theaters" />
        <Card title="Manage Movies" desc="Add or edit movie listings" to="/admin/movies" />
        {/* ✅ Screens -> absolute path */}
        <Card title="Manage Screens" desc="Add screens under theaters" to="/admin/screens" />
        <Card title="Manage Showtimes" desc="Schedule showtimes" to="/admin/showtimes" />
        <Card title="Update Pricing" desc="Adjust ticket pricing" to="/admin/pricing" />
        <Card title="Admin Analytics" desc="Sales & booking reports" to="/admin/analytics" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-gray-800 overflow-x-hidden bg-transparent">
      <Navbar />
      <main className="relative flex-grow">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <GlobalBackdrop />
        </div>
        <ScrollToTop />
        <div className="max-w-6xl mx-auto p-4">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<RedirectIfAdmin><AdminLogin /></RedirectIfAdmin>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />
            <Route path="/showtimes" element={<Showtimes />} />
            <Route path="/theaters" element={<TheatersPage />} />
            <Route path="/seats/:showtimeId" element={<SeatSelection />} />
            <Route path="/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/profile" element={<RequireAuth role="USER"><ProfilePage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth role="USER"><AccountInfo /></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth role="USER"><MyBookings /></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth role="USER"><TicketDetails /></RequireAuth>} />
            <Route path="/ticket/:bookingId" element={<RequireAuth role="USER"><TicketDetails /></RequireAuth>} />
            <Route path="/me" element={<RequireAuth role={["USER","SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><RoleProfileRouter /></RequireAuth>} />
            <Route path="/profile/me" element={<RequireAuth role={["USER","SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><RoleProfileRouter /></RequireAuth>} />

            {/* Admin landing */}
            <Route path="/admin" element={<RequireAuth role={["SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><div className="p-6"><AdminIndex /></div></RequireAuth>} />

            {/* SUPER_ADMIN only */}
            <Route path="/admin/dashboard" element={<RequireAuth role="SUPER_ADMIN"><div className="p-6"><h1 className="text-2xl font-semibold mb-4">Admin Dashboard</h1><AdminDashboardTiles /></div></RequireAuth>} />
            <Route path="/admin/theaters" element={<RequireAuth role="SUPER_ADMIN"><AdminTheaters /></RequireAuth>} />
            <Route path="/admin/showtimes" element={<RequireAuth role="SUPER_ADMIN"><AdminShowtimes /></RequireAuth>} />
            <Route path="/admin/movies" element={<RequireAuth role="SUPER_ADMIN"><AdminMoviesPage /></RequireAuth>} />
            <Route path="/admin/analytics" element={<RequireAuth role="SUPER_ADMIN"><AdminAnalytics /></RequireAuth>} />

            {/* Screens → open to SUPER_ADMIN, ADMIN, THEATRE_ADMIN */}
            <Route path="/admin/screens" element={<RequireAuth role={["SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><AdminScreens /></RequireAuth>} />

            {/* Shared */}
            <Route path="/admin/pricing" element={<RequireAuth role={["SUPER_ADMIN","THEATRE_ADMIN"]}><AdminPricing /></RequireAuth>} />
            <Route path="/admin/bookings/:id" element={<RequireAuth role={["SUPER_ADMIN","THEATRE_ADMIN"]}><AdminBookingDetails /></RequireAuth>} />

            {/* Theatre admin only */}
            <Route path="/theatre" element={<RequireAuth role="THEATRE_ADMIN"><TheatreIndex /></RequireAuth>} />
            <Route path="/theatre/my" element={<RequireAuth role="THEATRE_ADMIN"><TheatreDashboard /></RequireAuth>} />
            <Route path="/theatre/dashboard" element={<RequireAuth role="THEATRE_ADMIN"><Navigate to="/theatre/my" replace /></RequireAuth>} />
            <Route path="/theatre/screens" element={<RequireAuth role="THEATRE_ADMIN"><TheatreScreens /></RequireAuth>} />
            <Route path="/theatre/showtimes" element={<RequireAuth role="THEATRE_ADMIN"><TheatreShowtimes /></RequireAuth>} />
            <Route path="/theatre/profile" element={<RequireAuth role="THEATRE_ADMIN"><TheatreProfile /></RequireAuth>} />
            <Route path="/theatre/reports" element={<RequireAuth role="THEATRE_ADMIN"><TheatreReports /></RequireAuth>} />
            <Route path="/theatre/pricing" element={<RequireAuth role="THEATRE_ADMIN"><TheatrePricing /></RequireAuth>} />
            <Route path="/theatre/view" element={<RequireAuth role="THEATRE_ADMIN"><TheatreView /></RequireAuth>} />
            <Route path="/theatre/view/:id" element={<RequireAuth role="THEATRE_ADMIN"><TheatreView /></RequireAuth>} />

            {/* Super only */}
            <Route path="/super/theatre-admins" element={<RequireAuth role="SUPER_ADMIN"><TheatreAdmins /></RequireAuth>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
