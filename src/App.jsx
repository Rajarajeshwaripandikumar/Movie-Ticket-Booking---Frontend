// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layout
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import GlobalBackdrop from "./components/GlobalBackdrop";

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

// Theatre-admin pages (THEATER_ADMIN area)
import TheatreDashboard from "./pages/theatre/TheatreDashboard";
import TheatreScreens from "./pages/theatre/TheatreScreens";
import TheatreShowtimes from "./pages/theatre/TheatreShowtimes";
import TheatreProfile from "./pages/theatre/TheatreProfile";
import TheatreReports from "./pages/theatre/TheatreReports";

// Super-only: Theatre Admins listing page
import TheatreAdmins from "./pages/super/TheatreAdmins";

// SSE hook
import useSSE from "./hooks/useSSE";

/* ----------------------------- Helpers & Guards ----------------------------- */

function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}

/** Canonicalize a role string (handles aliases from backend & UI) */
function canonRole(r) {
  if (!r && r !== "") return "";
  const raw =
    typeof r === "object" && r !== null ? r.authority ?? r.value ?? r.name ?? "" : r;

  let v = String(raw).toUpperCase().trim().replace(/\s+/g, "_");
  if (v.startsWith("ROLE_")) v = v.slice(5);

  const map = {
    ADMIN: "SUPER_ADMIN",
    SUPERADMIN: "SUPER_ADMIN",
    THEATRE_ADMIN: "THEATER_ADMIN",
    THEATRE_MANAGER: "THEATER_ADMIN",
    THEATER_MANAGER: "THEATER_ADMIN",
    PVR_MANAGER: "THEATER_ADMIN",
    PVR_ADMIN: "THEATER_ADMIN",
    MANAGER: "THEATER_ADMIN",
  };
  v = map[v] ?? v;

  return v;
}

/** Read role from the JWT when context/localStorage don't have it */
function roleFromJwt(token) {
  try {
    if (!token) return "";
    const s = String(token).replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(
      atob(s.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const r =
      payload?.role ??
      (Array.isArray(payload?.roles) ? payload.roles[0] : undefined) ??
      (Array.isArray(payload?.authorities) ? payload.authorities[0] : undefined) ??
      payload?.authority ??
      "";
    return r;
  } catch {
    return "";
  }
}

/** RequireAuth guard — reads role from context/localStorage/JWT */
function RequireAuth({ children, role }) {
  if (process.env.REACT_APP_DEBUG_BYPASS_AUTH === "1") return children;

  const auth = useAuth() || {};
  const location = useLocation();

  const token =
    auth.token ||
    (typeof window !== "undefined" && window.localStorage?.getItem("token"));

  const needList = Array.isArray(role) ? role : role ? [role] : [];
  const need = needList.map(canonRole);

  // derive role from context, localStorage, then JWT payload
  const storedRole =
    auth.role ??
    (Array.isArray(auth.roles) && auth.roles.length ? auth.roles[0] : undefined) ??
    (typeof window !== "undefined" &&
      (JSON.parse(localStorage.getItem("roles") || "[]")[0] ||
        localStorage.getItem("role")));

  const jwtRole = roleFromJwt(token);
  const have = canonRole(storedRole || jwtRole);

  // allow deep-link with ?token=
  const urlToken = new URLSearchParams(location.search).get("token");
  if (!token && urlToken) return children;

  // not logged in → send to proper login
  if (!token) {
    const wantsAdmin = need.some((r) => r.includes("ADMIN"));
    return (
      <Navigate
        to={wantsAdmin ? "/admin/login" : "/login"}
        replace
        state={{ from: location }}
      />
    );
  }

  // no role needed
  if (!need.length) return children;

  // role match or SUPER can access THEATER routes
  if (need.includes(have) || (have === "SUPER_ADMIN" && need.includes("THEATER_ADMIN"))) {
    return children;
  }

  // any admin-ish role gets routed to /admin hub
  if (have.includes("ADMIN")) return <Navigate to="/admin" replace />;

  // fallback
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

/** Role-aware base routes */
function AdminIndex() {
  const auth = useAuth() || {};
  const token =
    auth.token ||
    (typeof window !== "undefined" && localStorage.getItem("token"));

  const r = canonRole(
    auth.role ??
      (Array.isArray(auth.roles) ? auth.roles[0] : undefined) ??
      roleFromJwt(token)
  );

  // ✅ Change: SUPER_ADMIN goes straight to Admin Dashboard
  if (r === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (r === "THEATER_ADMIN") return <Navigate to="/theatre/my" replace />;
  return <Navigate to="/" replace />;
}
function TheatreIndex() {
  return <Navigate to="/theatre/my" replace />;
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  useSSE();

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

            {/* ===== ROLE-AWARE ADMIN LANDING ===== */}
            <Route
              path="/admin"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATER_ADMIN"]}>
                  <AdminIndex />
                </RequireAuth>
              }
            />

            {/* SUPER_ADMIN actual dashboard */}
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminDashboard />
                </RequireAuth>
              }
            />

            {/* SUPER_ADMIN protected routes */}
            <Route
              path="/admin/profile"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATER_ADMIN"]}>
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
                <RequireAuth role={["SUPER_ADMIN", "THEATER_ADMIN"]}>
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
                <RequireAuth role={["SUPER_ADMIN", "THEATER_ADMIN"]}>
                  <AdminBookingDetails />
                </RequireAuth>
              }
            />

            {/* ===== THEATRE ADMIN ===== */}
            <Route
              path="/theatre"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreIndex />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/my"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/screens"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreScreens />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/showtimes"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreShowtimes />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/profile"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/reports"
              element={
                <RequireAuth role={["THEATER_ADMIN"]}>
                  <TheatreReports />
                </RequireAuth>
              }
            />

            {/* ---- SUPER namespace aliases (deep-link friendly) ---- */}
            <Route
              path="/super"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/super/theatre-admins"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <TheatreAdmins />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/theatre-admins"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <TheatreAdmins />
                </RequireAuth>
              }
            />
            <Route
              path="/super/movies"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminMoviesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/super/screens"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminScreens />
                </RequireAuth>
              }
            />
            <Route
              path="/super/showtimes"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminShowtimes />
                </RequireAuth>
              }
            />
            <Route
              path="/super/pricing"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminPricing />
                </RequireAuth>
              }
            />
            <Route
              path="/super/analytics"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/super/bookings/:id"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminBookingDetails />
                </RequireAuth>
              }
            />
            <Route
              path="/super/profile"
              element={
                <RequireAuth role={["SUPER_ADMIN"]}>
                  <AdminProfile />
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
