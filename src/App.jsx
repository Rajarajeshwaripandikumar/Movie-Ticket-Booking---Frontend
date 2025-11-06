// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

// Admin pages (SUPER_ADMIN)
import AdminDashboard from "./pages/AdminDashboard";
import AdminTheaters from "./pages/AdminTheaters";
import AdminScreens from "./pages/AdminScreens";
import AdminShowtimes from "./pages/AdminShowtimes";
import AdminPricing from "./pages/AdminPricing";
import AdminMoviesPage from "./pages/AdminMoviesPage";
import AdminProfile from "./pages/AdminProfile";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBookingDetails from "./pages/AdminBookingDetails";

// Theatre-admin pages
import TheatreDashboard from "./pages/theatre/TheatreDashboard";
import TheatreScreens from "./pages/theatre/TheatreScreens";
import TheatreShowtimes from "./pages/theatre/TheatreShowtimes";
import TheatreProfile from "./pages/theatre/TheatreProfile";
import TheatreReports from "./pages/theatre/TheatreReports";

// Super-only: Theatre Admins list
import TheatreAdmins from "./pages/super/TheatreAdmins";

/* ---------------- Helpers & Guards ---------------- */

function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}

function RequireAuth({ children, role }) {
  const auth = useAuth();
  const location = useLocation();

  const token = auth?.token || localStorage.getItem("token");
  const userRole = auth?.role;

  if (!token) {
    const isAdminRoute = Array.isArray(role) && role.some(r => r.includes("ADMIN"));
    return (
      <Navigate
        to={isAdminRoute ? "/admin/login" : "/login"}
        replace
        state={{ from: location }}
      />
    );
  }

  if (!role) return children;

  const allowed = Array.isArray(role) ? role : [role];
  if (allowed.includes(userRole)) return children;

  return <Navigate to="/" replace />;
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname, search]);
  return null;
}

function AdminIndex() {
  const auth = useAuth();
  if (auth.role === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (auth.role === "THEATER_ADMIN") return <Navigate to="/theatre/my" replace />;
  return <Navigate to="/" replace />;
}

function TheatreIndex() {
  return <Navigate to="/theatre/my" replace />;
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
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
            <Route path="/login" element={<Login role="USER" />} />
            <Route path="/register" element={<Register role="USER" />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Movies */}
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />
            <Route path="/showtimes" element={<Showtimes />} />

            {/* Booking */}
            <Route path="/seats/:showtimeId" element={<SeatSelection />} />
            <Route path="/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* User private */}
            <Route path="/profile" element={<RequireAuth role="USER"><ProfilePage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth role="USER"><AccountInfo /></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth role="USER"><MyBookings /></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth role="USER"><TicketDetails /></RequireAuth>} />

            {/* ========== ADMIN AREA ========== */}
            <Route path="/admin" element={<RequireAuth role={["SUPER_ADMIN", "THEATER_ADMIN"]}><AdminShell><AdminIndex /></AdminShell></RequireAuth>} />

            <Route path="/admin/dashboard" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminDashboard /></AdminShell></RequireAuth>} />
            <Route path="/admin/theaters" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminTheaters /></AdminShell></RequireAuth>} />
            <Route path="/admin/screens" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminScreens /></AdminShell></RequireAuth>} />
            <Route path="/admin/showtimes" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminShowtimes /></AdminShell></RequireAuth>} />
            <Route path="/admin/movies" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminMoviesPage /></AdminShell></RequireAuth>} />
            <Route path="/admin/profile" element={<RequireAuth role={["SUPER_ADMIN","THEATER_ADMIN"]}><AdminShell><AdminProfile /></AdminShell></RequireAuth>} />
            <Route path="/admin/pricing" element={<RequireAuth role={["SUPER_ADMIN","THEATER_ADMIN"]}><AdminShell><AdminPricing /></AdminShell></RequireAuth>} />
            <Route path="/admin/analytics" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><AdminAnalytics /></AdminShell></RequireAuth>} />
            <Route path="/admin/bookings/:id" element={<RequireAuth role={["SUPER_ADMIN","THEATER_ADMIN"]}><AdminShell><AdminBookingDetails /></AdminShell></RequireAuth>} />

            {/* ========== THEATRE ADMIN ========== */}
            <Route path="/theatre" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreIndex /></AdminShell></RequireAuth>} />
            <Route path="/theatre/my" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreDashboard /></AdminShell></RequireAuth>} />
            <Route path="/theatre/screens" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreScreens /></AdminShell></RequireAuth>} />
            <Route path="/theatre/showtimes" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreShowtimes /></AdminShell></RequireAuth>} />
            <Route path="/theatre/profile" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreProfile /></AdminShell></RequireAuth>} />
            <Route path="/theatre/reports" element={<RequireAuth role="THEATER_ADMIN"><AdminShell><TheatreReports /></AdminShell></RequireAuth>} />

            {/* Super theatre-admin list */}
            <Route path="/super/theatre-admins" element={<RequireAuth role="SUPER_ADMIN"><AdminShell><TheatreAdmins /></AdminShell></RequireAuth>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}
