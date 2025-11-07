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

/* ------------------------------- Helpers ---------------------------------- */

function NotFound() {
  return <p className="p-6 text-center text-gray-500">404 — Page not found</p>;
}

/** Normalize roles; canonical is THEATRE_ADMIN */
const normalizeRole = (r) => {
  if (!r) return null;
  let x = String(r).trim().toUpperCase().replace(/\s+/g, "_");
  if (x.startsWith("ROLE_")) x = x.slice(5);
  if (x === "THEATER_ADMIN") x = "THEATRE_ADMIN";
  if (x === "SUPERADMIN") x = "SUPER_ADMIN";
  return x;
};

/** Infer role if string missing but booleans exist in context */
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
    return (
      <Navigate
        to={needsAdmin ? "/admin/login" : "/login"}
        replace
        state={{ from: location }}
      />
    );
  }

  if (!role) return children;

  const allowed = Array.isArray(role) ? role.map(normalizeRole) : [normalizeRole(role)];

  if (currentRole === "SUPER_ADMIN") return children;
  if (currentRole && allowed.includes(currentRole)) return children;

  // If role blocked for this route, send each role to its home
  if (currentRole === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  if (currentRole === "ADMIN") return <Navigate to="/admin/screens" replace />; // ⬅️ fixed
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
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />; // ⬅️ fixed
  if (role === "THEATRE_ADMIN") return <Navigate to="/theatre/my" replace />;
  return <Navigate to="/" replace />;
}

function TheatreIndex() {
  return <Navigate to="/theatre/my" replace />;
}

/** NEW: If already logged-in admin, bounce away from /admin/login */
function RedirectIfAdmin({ children }) {
  const auth = useAuth();
  const role =
    normalizeRole(auth?.role || auth?.user?.role) ||
    inferRole(auth) ||
    (typeof window !== "undefined" && normalizeRole(localStorage.getItem("role")));

  if (role === "SUPER_ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (role === "ADMIN") return <Navigate to="/admin/screens" replace />; // ⬅️ fixed
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
  if (r === "ADMIN") return <Navigate to="/admin/screens" replace />; // ⬅️ fixed
  if (r === "THEATRE_ADMIN") return <Navigate to="/theatre/profile" replace />;
  return <Navigate to="/profile" replace />;
}

/* ----------------------------------- App ---------------------------------- */

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

            {/* Admin login: redirect if already authenticated */}
            <Route
              path="/admin/login"
              element={
                <RedirectIfAdmin>
                  <AdminLogin />
                </RedirectIfAdmin>
              }
            />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Movies */}
            <Route path="/movies" element={<Movies />} />
            <Route path="/movies/:movieId" element={<MovieDetail />} />
            <Route path="/showtimes" element={<Showtimes />} />
            <Route path="/theaters" element={<TheatersPage />} />

            {/* Booking */}
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
              path="/ticket/:bookingId"
              element={
                <RequireAuth role="USER">
                  <TicketDetails />
                </RequireAuth>
              }
            />

            {/* Smart role → profile */}
            <Route
              path="/me"
              element={
                <RequireAuth role={["USER", "SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}>
                  <RoleProfileRouter />
                </RequireAuth>
              }
            />
            <Route
              path="/profile/me"
              element={
                <RequireAuth role={["USER", "SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}>
                  <RoleProfileRouter />
                </RequireAuth>
              }
            />

            {/* ======== Admin Landing (any admin role) ======== */}
            <Route
              path="/admin"
              element={
                <RequireAuth role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}>
                  <AdminShell>
                    <AdminIndex />
                  </AdminShell>
                </RequireAuth>
              }
            />

            {/* SUPER_ADMIN ONLY */}
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <AdminDashboard />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/theaters"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <AdminTheaters />
                  </AdminShell>
                </RequireAuth>
              }
            />
            {/* 🔓 Screens allowed for SUPER_ADMIN, ADMIN, THEATRE_ADMIN */}
            <Route
              path="/admin/screens"
              element={
                <RequireAuth role={["SUPER_ADMIN", "ADMIN", "THEATRE_ADMIN"]}>
                  <AdminShell>
                    <AdminScreens />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/showtimes"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <AdminShowtimes />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/movies"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <AdminMoviesPage />
                  </AdminShell>
                </RequireAuth>
              }
            />
            {/* Admin profile open to SUPER_ADMIN + ADMIN */}
            <Route
              path="/admin/profile"
              element={
                <RequireAuth role={["SUPER_ADMIN", "ADMIN"]}>
                  <AdminShell>
                    <AdminProfile />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireAuth role="SUPER_ADMIN">
                  <AdminShell>
                    <AdminAnalytics />
                  </AdminShell>
                </RequireAuth>
              }
            />

            {/* SHARED (SUPER_ADMIN + THEATRE_ADMIN) */}
            <Route
              path="/admin/pricing"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                  <AdminShell>
                    <AdminPricing />
                  </AdminShell>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/bookings/:id"
              element={
                <RequireAuth role={["SUPER_ADMIN", "THEATRE_ADMIN"]}>
                  <AdminShell>
                    <AdminBookingDetails />
                  </AdminShell>
                </RequireAuth>
              }
            />

            {/* ======== THEATRE ADMIN ONLY ======== */}
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
              path="/theatre/dashboard"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <Navigate to="/theatre/my" replace />
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
              path="/theatre/view"
              element={
                <RequireAuth role="THEATRE_ADMIN">
                  <AdminShell>
                    <TheatreView />
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

            {/* SUPER_ADMIN only — manage theatre admins */}
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

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}
