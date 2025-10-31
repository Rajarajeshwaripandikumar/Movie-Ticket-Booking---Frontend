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

// 🧠 SSE hook
import useSSE from "./hooks/useSSE";

/* ----------------------------- Utils & Guards ----------------------------- */

function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}

/** Guard: requires auth + role */
function RequireAuth({ children, role }) {
  const { token, role: userRole } = useAuth();
  const { search } = useLocation();
  const urlToken = new URLSearchParams(search).get("token");

  const need = (role || "").toUpperCase();
  const have = (userRole || "").toUpperCase();

  // Allow tokenized email links
  if (!token && urlToken) return children;

  // Redirect if no token
  if (!token) {
    const loginPath = need === "ADMIN" ? "/admin/login" : "/login";
    return <Navigate to={loginPath} replace />;
  }

  // Redirect if role mismatch
  if (need && have !== need) {
    return have === "ADMIN" ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />;
  }

  return children;
}

/** Scroll to top on route change */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  // ✅ Initialize SSE connection when user logs in
  useSSE();

  return (
    <div className="flex flex-col min-h-screen text-gray-800 overflow-x-hidden bg-transparent">
      {/* Header stays plain */}
      <Navbar />

      {/* Main area ONLY (background lives here) */}
      <main className="relative flex-grow">
        {/* Background inside main, not behind navbar/footer */}
        <div className="absolute inset-0 -z-10">
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

            {/* Ticket / details */}
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

            {/* ADMIN protected routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth role="ADMIN">
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <RequireAuth role="ADMIN">
                  <AdminProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/movies"
              element={
                <RequireAuth role="ADMIN">
                  <AdminMoviesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/theaters"
              element={
                <RequireAuth role="ADMIN">
                  <AdminTheaters />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/screens"
              element={
                <RequireAuth role="ADMIN">
                  <AdminScreens />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/showtimes"
              element={
                <RequireAuth role="ADMIN">
                  <AdminShowtimes />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/pricing"
              element={
                <RequireAuth role="ADMIN">
                  <AdminPricing />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireAuth role="ADMIN">
                  <AdminAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/bookings/:id"
              element={
                <RequireAuth role="ADMIN">
                  <AdminBookingDetails />
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

      {/* Footer stays plain */}
      <Footer />
    </div>
  );
}
