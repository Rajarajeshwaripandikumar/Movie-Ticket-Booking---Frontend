// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layout
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import GlobalBackdrop from "./components/GlobalBackdrop"; // background component

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

// Admin pages (SUPER_ADMIN area)
import AdminDashboard from "./pages/AdminDashboard";
import AdminTheaters from "./pages/AdminTheaters";
import AdminScreens from "./pages/AdminScreens";
import AdminShowtimes from "./pages/AdminShowtimes";
import AdminPricing from "./pages/AdminPricing";
import AdminMoviesPage from "./pages/AdminMoviesPage";
import AdminProfile from "./pages/AdminProfile";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBookingDetails from "./pages/AdminBookingDetails";

// Theatre-admin pages (THEATRE_ADMIN area)
import TheatreDashboard from "./pages/theatre/TheatreDashboard";
import TheatreScreens from "./pages/theatre/TheatreScreens";
import TheatreShowtimes from "./pages/theatre/TheatreShowtimes";
import TheatreProfile from "./pages/theatre/TheatreProfile";
import TheatreReports from "./pages/theatre/TheatreReports";

// SSE hook
import useSSE from "./hooks/useSSE";

/* ----------------------------- Helpers & Guards ----------------------------- */

/** NotFound fallback */
function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}

/**
 * RequireAuth guard
 * - children: element to render
 * - role: undefined | "USER" | "THEATRE_ADMIN" | "SUPER_ADMIN" | array of roles
 *
 * Notes:
 * - reads token from useAuth() but also falls back to localStorage token to avoid brief missing-token issues.
 * - normalizes role strings to uppercase.
 * - optional debug bypass via REACT_APP_DEBUG_BYPASS_AUTH=1 (use only for local debugging)
 */
function RequireAuth({ children, role }) {
  // Debug bypass (use only locally)
  if (process.env.REACT_APP_DEBUG_BYPASS_AUTH === "1") {
    return children;
  }

  const auth = useAuth() || {};
  // prefer provider token, fallback to localStorage (helps SSR/rehydration timing)
  const token = auth.token || (typeof window !== "undefined" && window.localStorage?.getItem("token"));
  const userRoleRaw = auth.role || (typeof window !== "undefined" && window.localStorage?.getItem("role"));

  const normalize = (r) => (r ? String(r).toUpperCase() : "");
  const needRaw = role;
  const need = Array.isArray(needRaw) ? needRaw.map(normalize) : needRaw ? [normalize(needRaw)] : [];
  const have = normalize(userRoleRaw);

  // allow token via query param for special endpoints (streams / email links)
  const { search } = useLocation();
  const urlToken = new URLSearchParams(search).get("token");
  if (!token && urlToken) return children;

  // not logged in -> redirect to login; if admin route requested, go to admin login
  if (!token) {
    const wantsAdmin = need.some((r) => r.includes("ADMIN"));
    const loginPath = wantsAdmin ? "/admin/login" : "/login";
    return <Navigate to={loginPath} replace />;
  }

  // no specific role required -> allow
  if (!need.length) return children;

  // exact role allowed
  if (need.includes(have)) return children;

  // super admin access to theatre admin? optionally allow — uncomment if desired
  // if (have === "SUPER_ADMIN" && need.includes("THEATRE_ADMIN")) return children;

  // if user has any admin substring but not matching required -> send to admin index
  if (have.includes("ADMIN")) return <Navigate to="/admin" replace />;

  // otherwise not allowed -> home
  return <Navigate to="/" replace />;
}

/** scroll to top on route change */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  // initialize SSE hook (no-op if not used)
  useSSE();

  return (
    <div className="flex flex-col min-h-screen text-gray-800 overflow-x-hidden bg-transparent">
      <Navbar />

      <main className="relative flex-grow">
        {/* Backdrop should not block pointer events */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <GlobalBackdrop />
        </div>

        <ScrollToTop />

        <div className="max-w-6xl mx-auto p-4">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login role="USER" />} />
            <Route path="/register" element={<Register role="USER" />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<Register role="ADMIN" />} />

            {/* Movies & showtimes */}
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />
            <Route path="/showtimes" element={<Showtimes key="byTheater" />} />
            <Route path="/showtimes/:movieId" element={<Showtimes key="byMovie" />} />
            <Route path="/theaters" element={<TheatersPage />} />
            <Route
              path="/theaters/:theaterId/screens/:screenId/showtimes"
              element={<Showtimes key="byScreen" />}
            />

            {/* Booking flow */}
            <Route path="/seats/:showtimeId" element={<SeatSelection />} />
            <Route path="/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* Auth / password */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Ticket / details (USER) */}
            <Route
              path="/bookings/:id"
              element={
                <RequireAuth role="USER">
                  <TicketDetails />
                </RequireAuth>
              }
            />
            <Route
              path="/ticket/:bookingId"
              element={
                <RequireAuth role="USER">
                  <TicketDetails />
                </RequireAuth>
              }
            />

            {/* USER protected routes */}
            <Route
              path="/account"
              element={
                <RequireAuth role="USER">
                  <AccountInfo />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth role="USER">
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireAuth role="USER">
                  <MyBookings />
                </RequireAuth>
              }
            />

            {/* SUPER_ADMIN protected routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                  <AdminProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/movies"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminMoviesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/theaters"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminTheaters />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/screens"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminScreens />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/showtimes"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminShowtimes />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/pricing"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                  <AdminPricing />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/bookings/:id"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                  <AdminBookingDetails />
                </RequireAuth>
              }
            />

            {/* THEATRE_ADMIN scoped routes */}
            <Route
              path="/theatre/my"
              element={
                <RequireAuth role={["THEATRE_ADMIN"]}>
                  <TheatreDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/screens"
              element={
                <RequireAuth role={["THEATRE_ADMIN"]}>
                  <TheatreScreens />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/showtimes"
              element={
                <RequireAuth role={["THEATRE_ADMIN"]}>
                  <TheatreShowtimes />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/profile"
              element={
                <RequireAuth role={["THEATRE_ADMIN"]}>
                  <TheatreProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/reports"
              element={
                <RequireAuth role={["THEATRE_ADMIN"]}>
                  <TheatreReports />
                </RequireAuth>
              }
            />

            {/* Redirect from legacy reports */}
            <Route path="/admin/reports" element={<Navigate to="/admin/analytics" replace />} />

            {/* 404 fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}
