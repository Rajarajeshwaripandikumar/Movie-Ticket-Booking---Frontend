// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import api, { getAuthFromStorage } from "./api/api"; // <-- api priming
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import GlobalBackdrop from "./components/GlobalBackdrop";
import AdminShell from "./layouts/AdminShell";

//
// Public pages
//
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

//
// User pages
//
import AccountInfo from "./pages/AccountInfo";
import ProfilePage from "./pages/ProfilePage";
import MyBookings from "./pages/MyBookings";

//
// Admin pages
//
import AdminDashboard from "./pages/AdminDashboard";
import AdminTheaters from "./pages/AdminTheaters";
import AdminScreens from "./pages/AdminScreens";
import AdminShowtimes from "./pages/AdminShowtimes";
import AdminPricing from "./pages/AdminPricing";
import AdminMoviesPage from "./pages/AdminMoviesPage";
import AdminProfile from "./pages/AdminProfile";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBookingDetails from "./pages/AdminBookingDetails";

//
// Notifications (single, role-aware page)
//
import NotificationsPage from "./pages/NotificationsPage";

//
// Theatre Admin pages
//
import TheatreDashboard from "./pages/theatre/TheatreDashboard";
import TheatreScreens from "./pages/theatre/TheatreScreens";
import TheatreShowtimes from "./pages/theatre/TheatreShowtimes";
import TheatreProfile from "./pages/theatre/TheatreProfile";
import TheatreReports from "./pages/theatre/TheatreReports";
import TheatrePricing from "./pages/theatre/TheatrePricing";
import TheatreView from "./pages/theatre/TheatreView";

//
// Super Admin Only
//
import TheatreAdmins from "./pages/super/TheatreAdmins";

/* ---------------------- tiny UI helpers used in loaders --------------------- */
function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}
function Loader() {
  return (
    <div className="w-full py-10 flex items-center justify-center">
      <div className="animate-pulse text-sm text-gray-500">Loading…</div>
    </div>
  );
}

/* ---------------------------- role utilities ------------------------------- */
const normalizeRole = (r) => {
  if (!r) return null;
  let x = String(r).trim().toUpperCase().replace(/\s+/g, "_");
  if (x.startsWith("ROLE_")) x = x.slice(5);
  if (x === "THEATER_ADMIN") x = "THEATRE_ADMIN";
  if (x === "SUPERADMIN") x = "SUPER_ADMIN";
  return x;
};

const getEffectiveRole = (auth) => {
  if (!auth) return null;
  const base = normalizeRole(auth.role || auth.user?.role);
  if (base) return base;

  if (auth.isSuperAdmin) return "SUPER_ADMIN";
  if (auth.isTheatreAdmin) return "THEATRE_ADMIN";
  if (auth.isAdmin) return "ADMIN";
  return auth.isLoggedIn ? "USER" : null;
};

/* ------------------------- Guarded auth components ------------------------ */
/**
 * Generic auth + role guard.
 * - If not logged in → goes to `/login` or `/admin/login` depending on requested role.
 * - If logged in but role doesn't match → goes to `/` (no bouncing between admin routes).
 */
function RequireAuth({ children, role }) {
  const auth = useAuth();
  const location = useLocation();

  const { initialized, isLoggedIn } = auth || {};

  if (!initialized) return <Loader />;

  // Not logged in → send to appropriate login page
  if (!isLoggedIn) {
    const needsAdmin = Array.isArray(role)
      ? role
          .map(normalizeRole)
          .some((r) => ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(r))
      : ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(
          normalizeRole(role)
        );

    const loginTarget = needsAdmin ? "/admin/login" : "/login";

    if (location.pathname === loginTarget) {
      // already at that login page; just render the child (e.g. login form)
      return children ?? null;
    }

    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  // No role requirement → any logged-in user allowed
  if (!role) return children;

  const currentRole = getEffectiveRole(auth);
  const allowedRoles = Array.isArray(role)
    ? role.map(normalizeRole)
    : [normalizeRole(role)];

  // Super admin can access everything
  if (currentRole === "SUPER_ADMIN") return children;

  // If role is explicitly allowed
  if (allowedRoles.includes(currentRole)) return children;

  // Not allowed → go to a safe place (home). No bouncing to another protected route.
  if (location.pathname === "/") return null;
  return <Navigate to="/" replace />;
}

/**
 * When visiting `/admin/login`:
 * - If not logged in → show AdminLogin.
 * - If logged in as SUPER_ADMIN or ADMIN → go to `/admin/dashboard`.
 * - If logged in as THEATRE_ADMIN → go to `/theatre/dashboard`.
 * No localStorage fallbacks (prevents stale-role loops).
 */
function RedirectIfAdmin({ children }) {
  const auth = useAuth();
  const location = useLocation();

  const { initialized, isLoggedIn } = auth || {};

  if (!initialized) return <Loader />;

  // Not logged in → show the child (admin login page)
  if (!isLoggedIn) return children;

  const role = getEffectiveRole(auth);

  let target = null;
  if (role === "SUPER_ADMIN" || role === "ADMIN") target = "/admin/dashboard";
  if (role === "THEATRE_ADMIN") target = "/theatre/dashboard";

  if (target && location.pathname !== target) {
    return <Navigate to={target} replace />;
  }

  return children;
}

/**
 * `/admin` index route:
 * - SUPER_ADMIN / ADMIN → `/admin/dashboard`
 * - THEATRE_ADMIN → `/theatre/dashboard`
 * It assumes RequireAuth already made sure the user is logged in and admin-ish.
 */
function AdminIndex() {
  const auth = useAuth();
  const location = useLocation();

  const { initialized, isLoggedIn } = auth || {};

  if (!initialized) return <Loader />;

  // If somehow not logged in here, kick to admin login
  if (!isLoggedIn) {
    if (location.pathname === "/admin/login") return null;
    return <Navigate to="/admin/login" replace />;
  }

  const r = getEffectiveRole(auth);
  if (!r) return <Loader />;

  const target =
    r === "THEATRE_ADMIN" ? "/theatre/dashboard" : "/admin/dashboard";

  if (location.pathname === target) return null;
  return <Navigate to={target} replace />;
}

/**
 * `/me` router:
 * - SUPER_ADMIN / ADMIN → `/admin/dashboard`
 * - THEATRE_ADMIN → `/theatre/profile`
 * - USER → `/profile`
 */
function RoleProfileRouter() {
  const auth = useAuth();
  const location = useLocation();

  const { initialized, isLoggedIn } = auth || {};

  if (!initialized) return <Loader />;

  if (!isLoggedIn) {
    if (location.pathname === "/login") return null;
    return <Navigate to="/login" replace />;
  }

  const r = getEffectiveRole(auth) || "USER";

  const adminTarget = "/admin/dashboard";
  const theatreTarget = "/theatre/dashboard";
  const userTarget = "/profile";

  let target = userTarget;
  if (r === "SUPER_ADMIN" || r === "ADMIN") target = adminTarget;
  if (r === "THEATRE_ADMIN") target = theatreTarget;

  if (location.pathname === target) return null;
  return <Navigate to={target} replace />;
}

/* ---------------------------------- App ---------------------------------- */
export default function App() {
  // Prime axios from any auth found in storage on initial paint.
  useEffect(() => {
    try {
      const { token } = getAuthFromStorage();
      const adminToken = localStorage.getItem("adminToken");
      const effectiveToken = adminToken || token;

      if (effectiveToken) {
        api.setAuthToken(effectiveToken);
        // eslint-disable-next-line no-console
        console.debug("[App] primed axios with token from storage");
      }
    } catch (e) {
      console.debug("[App] priming failed", e);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen text-gray-800 overflow-x-hidden bg-transparent">
      <Navbar />
      <main className="relative flex-grow">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <GlobalBackdrop />
        </div>

        {/* NavigationWatcher removed */}

        <div className="max-w-6xl mx-auto p-4">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login role="USER" />} />
            <Route path="/register" element={<Register role="USER" />} />
            <Route
              path="/admin/login"
              element={
                <RedirectIfAdmin>
                  <AdminLogin />
                </RedirectIfAdmin>
              }
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Movies */}
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />

            {/* Showtimes (both base and :movieId) */}
            <Route path="/showtimes" element={<Showtimes />} />
            <Route path="/showtimes/:movieId" element={<Showtimes />} />

            <Route path="/theaters" element={<TheatersPage />} />

            {/* Seat Flow */}
            <Route path="/seats/:showtimeId" element={<SeatSelection />} />
            <Route path="/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* User private */}
            <Route
              path="/profile"
              element={
                <RequireAuth role="USER">
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth role="USER">
                  <AccountInfo />
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
            <Route
              path="/bookings/:id"
              element={
                <RequireAuth role="USER">
                  <TicketDetails />
                </RequireAuth>
              }
            />

            {/* User notifications (self) */}
            <Route
              path="/notifications"
              element={
                <RequireAuth role="USER">
                  <NotificationsPage />
                </RequireAuth>
              }
            />

            <Route
              path="/me"
              element={
                <RequireAuth
                  role={["USER", "SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}
                >
                  <RoleProfileRouter />
                </RequireAuth>
              }
            />

            {/* ADMIN SECTION */}
            <Route
              path="/admin"
              element={
                <RequireAuth
                  role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}
                >
                  <AdminShell />
                </RequireAuth>
              }
            >
              <Route index element={<AdminIndex />} />

              {/* SUPER_ADMIN ONLY */}
              <Route
                path="dashboard"
                element={
                  <RequireAuth role="SUPER_ADMIN">
                    <AdminDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="theaters"
                element={
                  <RequireAuth role="SUPER_ADMIN">
                    <AdminTheaters />
                  </RequireAuth>
                }
              />
              <Route
                path="movies"
                element={
                  <RequireAuth role="SUPER_ADMIN">
                    <AdminMoviesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="analytics"
                element={
                  <RequireAuth role="SUPER_ADMIN">
                    <AdminAnalytics />
                  </RequireAuth>
                }
              />

              {/* Notifications (view all from bell) */}
              <Route
                path="notifications"
                element={
                  <RequireAuth role={["SUPER_ADMIN", "ADMIN"]}>
                    <NotificationsPage />
                  </RequireAuth>
                }
              />

              {/* Shared admin routes */}
              <Route
                path="screens"
                element={
                  <RequireAuth
                    role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}
                  >
                    <AdminScreens />
                  </RequireAuth>
                }
              />
              <Route
                path="showtimes"
                element={
                  <RequireAuth
                    role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}
                  >
                    <AdminShowtimes />
                  </RequireAuth>
                }
              />

              {/* Pricing + Bookings for SUPER + THEATRE ADMIN */}
              <Route
                path="pricing"
                element={
                  <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                    <AdminPricing />
                  </RequireAuth>
                }
              />
              <Route
                path="bookings/:id"
                element={
                  <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                    <AdminBookingDetails />
                  </RequireAuth>
                }
              />

              {/* Profile for SUPER_ADMIN + ADMIN */}
              <Route
                path="profile"
                element={
                  <RequireAuth role={["SUPER_ADMIN", "ADMIN"]}>
                    <AdminProfile />
                  </RequireAuth>
                }
              />
            </Route>

            {/* THEATRE ADMIN SECTION (nested) */}
            <Route
              path="/theatre"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell />
                </RequireAuth>
              }
            >
              {/* index → dashboard; keep /theatre/my as legacy redirect */}
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<TheatreDashboard />} />
              <Route path="my" element={<Navigate to="dashboard" replace />} />
              <Route path="screens" element={<TheatreScreens />} />
              <Route path="showtimes" element={<TheatreShowtimes />} />
              <Route path="profile" element={<TheatreProfile />} />
              <Route path="reports" element={<TheatreReports />} />
              <Route path="pricing" element={<TheatrePricing />} />
              <Route path="view/:id" element={<TheatreView />} />

              {/* Theatre notifications uses same NotificationsPage component */}
              <Route
                path="notifications"
                element={
                  <RequireAuth role="THEATRE_ADMIN">
                    <NotificationsPage />
                  </RequireAuth>
                }
              />
            </Route>

            {/* SUPER ONLY (separate section) */}
            <Route
              path="/super"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell />
                </RequireAuth>
              }
            >
              <Route path="theatre-admins" element={<TheatreAdmins />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
