import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layout
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import GlobalBackdrop from "./components/GlobalBackdrop";
import AdminShell from "./layouts/AdminShell";

// Public pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Register from "./pages/Register";
import Movies from "./pages/Movies";
import MovieDetail from "./pages/MovieDetail";
import Showtimes from "./pages/Showtimes";
import SeatSelection from "./pages/SeatSelection";
import Checkout from "./pages/Checkout";
import PaymentPage from "./pages/PaymentPage";
import TheatersPage from "./pages/TheatersPage";
import TicketDetails from "./pages/TicketDetails";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// User pages
import AccountInfo from "./pages/AccountInfo";
import ProfilePage from "./pages/ProfilePage";
import MyBookings from "./pages/MyBookings";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminTheaters from "./pages/AdminTheaters";
import AdminScreens from "./pages/AdminScreens";
import AdminShowtimes from "./pages/AdminShowtimes";
import AdminPricing from "./pages/AdminPricing";
import AdminMoviesPage from "./pages/AdminMoviesPage";
import AdminProfile from "./pages/AdminProfile";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBookingDetails from "./pages/AdminBookingDetails";

// Theatre Admin pages
import TheatreDashboard from "./pages/theatre/TheatreDashboard";
import TheatreScreens from "./pages/theatre/TheatreScreens";
import TheatreShowtimes from "./pages/theatre/TheatreShowtimes";
import TheatreProfile from "./pages/theatre/TheatreProfile";
import TheatreReports from "./pages/theatre/TheatreReports";
import TheatrePricing from "./pages/theatre/TheatrePricing";
import TheatreView from "./pages/theatre/TheatreView";

// Super-only
import TheatreAdmins from "./pages/super/TheatreAdmins";

/* ---------------------- Helpers ---------------------- */

const normalizeRole = (r) => {
  if (!r) return null;
  let x = r.toString().trim().toUpperCase().replace(/\s+/g, "_");
  if (x.startsWith("ROLE_")) x = x.slice(5);
  if (x === "THEATER_ADMIN") x = "THEATRE_ADMIN";
  if (x === "SUPERADMIN") x = "SUPER_ADMIN";
  return x;
};

const inferRole = (auth) => {
  if (auth?.isSuperAdmin) return "SUPER_ADMIN";
  if (auth?.isAdmin) return "ADMIN";
  if (auth?.isTheatreAdmin || auth?.isTheaterAdmin) return "THEATRE_ADMIN";
  return null;
};

function RequireAuth({ children, role }) {
  const auth = useAuth();
  const location = useLocation();

  const currentRole =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    normalizeRole(localStorage.getItem("role"));

  const hasSession =
    auth?.isAuthenticated ||
    auth?.adminToken ||
    auth?.token ||
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken");

  if (!hasSession) {
    const isAdminRoute = ["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"].includes(
      normalizeRole(role)
    );
    return <Navigate to={isAdminRoute ? "/admin/login" : "/login"} state={{ from: location }} replace />;
  }

  if (!role) return children;

  const allowedRoles = Array.isArray(role) ? role.map(normalizeRole) : [normalizeRole(role)];
  if (currentRole === "SUPER_ADMIN") return children;
  if (allowedRoles.includes(currentRole)) return children;

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
    normalizeRole(localStorage.getItem("role"));

  if (role === "SUPER_ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  return <Navigate to="/" replace />;
}

function RedirectIfAdmin({ children }) {
  const auth = useAuth();
  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    normalizeRole(localStorage.getItem("role"));

  if (role === "SUPER_ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (role === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  return children;
}

function RoleProfileRouter() {
  const auth = useAuth();
  const r =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    normalizeRole(localStorage.getItem("role"));

  if (r === "SUPER_ADMIN") return <Navigate to="/admin/screens" replace />;
  if (r === "ADMIN") return <Navigate to="/admin/screens" replace />;
  if (r === "THEATRE_ADMIN") return <Navigate to="/theatre/profile" replace />;
  return <Navigate to="/profile" replace />;
}

/* ---------------------- App ---------------------- */

export default function App() {
  return (
    <div className="flex flex-col min-h-screen text-gray-800 overflow-x-hidden bg-transparent">
      <Navbar />
      <main className="relative flex-grow">
        <div className="absolute inset-0 -z-10 pointer-events-none"><GlobalBackdrop /></div>
        <ScrollToTop />
        <div className="max-w-6xl mx-auto p-4">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login role="USER" />} />
            <Route path="/register" element={<Register role="USER" />} />
            <Route path="/admin/login" element={<RedirectIfAdmin><AdminLogin /></RedirectIfAdmin>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />
            <Route path="/showtimes" element={<Showtimes />} />
            <Route path="/theaters" element={<TheatersPage />} />
            <Route path="/seats/:showtimeId" element={<SeatSelection />} />
            <Route path="/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* User Private */}
            <Route path="/profile" element={<RequireAuth role="USER"><ProfilePage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth role="USER"><AccountInfo /></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth role="USER"><MyBookings /></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth role="USER"><TicketDetails /></RequireAuth>} />

            {/* Role Smart */}
            <Route path="/me" element={<RequireAuth role={["USER","SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><RoleProfileRouter /></RequireAuth>} />

            {/* Admin Nested */}
            <Route path="/admin" element={<RequireAuth role={["SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><AdminShell><Outlet /></AdminShell></RequireAuth>}>
              <Route index element={<AdminIndex />} />

              <Route path="screens" element={<RequireAuth role={["SUPER_ADMIN","ADMIN","THEATRE_ADMIN"]}><AdminScreens /></RequireAuth>} />
              <Route path="movies" element={<RequireAuth role="SUPER_ADMIN"><AdminMoviesPage /></RequireAuth>} />
              <Route path="dashboard" element={<RequireAuth role="SUPER_ADMIN"><AdminDashboard /></RequireAuth>} />
              <Route path="theaters" element={<RequireAuth role="SUPER_ADMIN"><AdminTheaters /></RequireAuth>} />
              <Route path="analytics" element={<RequireAuth role="SUPER_ADMIN"><AdminAnalytics /></RequireAuth>} />
              <Route path="pricing" element={<RequireAuth role={["SUPER_ADMIN","THEATRE_ADMIN"]}><AdminPricing /></RequireAuth>} />
              <Route path="bookings/:id" element={<RequireAuth role={["SUPER_ADMIN","THEATRE_ADMIN"]}><AdminBookingDetails /></RequireAuth>} />
              <Route path="profile" element={<RequireAuth role={["SUPER_ADMIN","ADMIN"]}><AdminProfile /></RequireAuth>} />
            </Route>

            {/* Theatre Admin */}
            <Route path="/theatre/my" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatreDashboard /></AdminShell></RequireAuth>} />
            <Route path="/theatre/screens" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatreScreens /></AdminShell></RequireAuth>} />
            <Route path="/theatre/showtimes" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatreShowtimes /></AdminShell></RequireAuth>} />
            <Route path="/theatre/profile" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatreProfile /></AdminShell></RequireAuth>} />
            <Route path="/theatre/reports" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatreReports /></AdminShell></RequireAuth>} />
            <Route path="/theatre/pricing" element={<RequireAuth role="THEATRE_ADMIN"><AdminShell><TheatrePricing /></AdminShell></RequireAuth>} />

            {/* Super Only */}
            <Route path="/super/theatre-admins" element={
              <RequireAuth role="SUPER_ADMIN">
                <AdminShell>
                  <TheatreAdmins />
                </AdminShell>
              </RequireAuth>
            } />

            <Route path="*" element={<p className="p-6 text-center text-gray-500">404 — Page not found</p>} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
