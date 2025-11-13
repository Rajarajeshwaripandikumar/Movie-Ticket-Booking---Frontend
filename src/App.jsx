// src/App.jsx (FULL UPDATED CODE — Option B canonical /admin/dashboard)
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

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

// Super Admin Only
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
const inferRole = (auth) => {
  if (!auth) return null;
  if (auth.isSuperAdmin) return "SUPER_ADMIN";
  if (auth.isAdmin) return "ADMIN";
  if (auth.isTheatreAdmin || auth.isTheaterAdmin) return "THEATRE_ADMIN";
  if (auth.isAuthenticated || auth.user || auth.token) return "USER";
  return null;
};

/* --------------------------- Navigation watcher --------------------------- */
/* Keep while debugging; remove when stable */
function NavigationWatcher() {
  const location = useLocation();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn("[NavigationWatcher] navigated to:", location.pathname, new Date().toISOString());
  }, [location.pathname]);
  return null;
}

/* ------------------------- Guarded auth components ------------------------ */
// NOTE: Option B — canonical admin landing is /admin/dashboard

function RequireAuth({ children, role }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) return <Loader />;

  const roleFromCtx =
    normalizeRole(auth?.role || auth?.user?.role) || inferRole(auth);
  const roleFromStorage =
    typeof window !== "undefined"
      ? normalizeRole(localStorage.getItem("role"))
      : null;
  const currentRole = normalizeRole(roleFromCtx || roleFromStorage);

  const hasSession =
    !!auth?.isAuthenticated ||
    !!auth?.token ||
    (typeof window !== "undefined" && !!localStorage.getItem("token"));

  if (!hasSession) {
    const needsAdmin = Array.isArray(role)
      ? role.map(normalizeRole).some((r) =>
          ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(r)
        )
      : ["SUPER_ADMIN", "THEATRE_ADMIN", "ADMIN"].includes(normalizeRole(role));

    const loginTarget = needsAdmin ? "/admin/login" : "/login";

    // don't repeatedly navigate to the same login page
    if (location.pathname === loginTarget) return null;

    return (
      <Navigate to={loginTarget} replace state={{ from: location }} />
    );
  }

  // If route expects a role but we haven't resolved it yet, show loader
  if (role && !currentRole) return <Loader />;
  if (!role) return children;

  const allowed = Array.isArray(role)
    ? role.map(normalizeRole)
    : [normalizeRole(role)];

  if (currentRole === "SUPER_ADMIN") return children;
  if (currentRole && allowed.includes(currentRole)) return children;

  // redirect to role-specific home, but guard against re-navigation
  if (currentRole === "THEATRE_ADMIN") {
    if (location.pathname === "/theatre/my") return null;
    return <Navigate to="/theatre/my" replace />;
  }
  if (currentRole === "ADMIN") {
    if (location.pathname === "/admin/dashboard") return null;
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (location.pathname === "/") return null;
  return <Navigate to="/" replace />;
}

function AdminIndex() {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) return <Loader />;

  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" &&
      normalizeRole(localStorage.getItem("role")));

  if (!role) return <Loader />;

  // Option B: canonical admin landing is /admin/dashboard
  const target = role === "THEATRE_ADMIN" ? "/theatre/my" : "/admin/dashboard";

  // avoid redirecting to the current path (prevents loops)
  if (location.pathname === target) return null;

  return <Navigate to={target} replace />;
}

function TheatreIndex() {
  return <Navigate to="/theatre/my" replace />;
}

function RedirectIfAdmin({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) return <Loader />;

  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" &&
      normalizeRole(localStorage.getItem("role")));

  const hasSession =
    !!auth?.isAuthenticated ||
    !!auth?.token ||
    (typeof window !== "undefined" && !!localStorage.getItem("token"));

  if (hasSession && !role) return <Loader />;

  let target = null;
  if (role === "SUPER_ADMIN" || role === "ADMIN") target = "/admin/dashboard";
  if (role === "THEATRE_ADMIN") target = "/theatre/my";

  // only redirect if we have a target AND it's not the current path
  if (target && location.pathname !== target) {
    return <Navigate to={target} replace />;
  }

  return children;
}

function RoleProfileRouter() {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) return <Loader />;

  const r =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" &&
      normalizeRole(localStorage.getItem("role")));

  const hasSession =
    !!auth?.isAuthenticated ||
    !!auth?.token ||
    (typeof window !== "undefined" && !!localStorage.getItem("token"));

  if (hasSession && !r) return <Loader />;

  const adminTarget = "/admin/dashboard";
  const theatreTarget = "/theatre/profile";
  const userTarget = "/profile";

  if (r === "SUPER_ADMIN" || r === "ADMIN") {
    if (location.pathname === adminTarget) return null;
    return <Navigate to={adminTarget} replace />;
  }
  if (r === "THEATRE_ADMIN") {
    if (location.pathname === theatreTarget) return null;
    return <Navigate to={theatreTarget} replace />;
  }

  if (location.pathname === userTarget) return null;
  return <Navigate to={userTarget} replace />;
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

        <NavigationWatcher />

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
            <Route path="/showtimes" element={<Showtimes />} />
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

            {/* ADMIN */}
            <Route
              path="/admin"
              element={
                <RequireAuth role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}>
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

            {/* THEATRE ADMIN SECTION */}
            <Route
              path="/theatre"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreIndex />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/my"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreDashboard />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/screens"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreScreens />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/showtimes"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreShowtimes />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/profile"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreProfile />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/reports"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreReports />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/pricing"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatrePricing />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/theatre/view/:id"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreView />
                  </AdminShell>
                </RequireAuth>
              }
            />

            {/* SUPER ONLY */}
            <Route
              path="/super/theatre-admins"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <TheatreAdmins />
                  </AdminShell>
                </RequireAuth>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
