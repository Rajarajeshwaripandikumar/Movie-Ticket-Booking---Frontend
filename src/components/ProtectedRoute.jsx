// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Normalize a single role string (handles THEATRE → THEATER) */
function normRole(r) {
  if (!r && r !== "") return null;
  try {
    const v = String(r).trim().toUpperCase().replace(/\s+/g, "_");
    return v === "THEATRE_ADMIN" ? "THEATER_ADMIN" : v;
  } catch {
    return null;
  }
}

/** Normalize a list of roles (string or array) to a Set of canonical roles */
function normWanted(roles) {
  if (!roles) return new Set();
  if (Array.isArray(roles)) return new Set(roles.map(normRole).filter(Boolean));
  return new Set([normRole(roles)].filter(Boolean));
}

/**
 * ProtectedRoute
 * Usage examples:
 *   // As a wrapper
 *   <ProtectedRoute roles="SUPER_ADMIN"><Page/></ProtectedRoute>
 *   <ProtectedRoute roles={["THEATER_ADMIN"]}><Page/></ProtectedRoute>
 *
 *   // As a route guard (preferred with React Router v6+)
 *   <Route element={<ProtectedRoute roles={["ADMIN","SUPER_ADMIN"]} />}>
 *     <Route path="/admin/dashboard" element={<Dashboard/>} />
 *   </Route>
 */
export default function ProtectedRoute({
  children,
  roles,                       // string | string[]
  superOverrides = true,       // allow SUPER_ADMIN to enter any admin-only route
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin",
  publicHome = "/",
}) {
  const { token, role, roles: userRoles } = useAuth();
  const location = useLocation();

  // Build the caller's required roles
  const wanted = normWanted(roles);

  // Figure out if the route is "admin-ish" based on required roles
  const wantsAdmin =
    wanted.size > 0
      ? Array.from(wanted).some((r) => r?.includes("ADMIN"))
      : false;

  // If not logged in → send to the correct login, preserving where user came from
  if (!token) {
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Gather the user's roles (prefer roles[], fallback to single role)
  const haveList = Array.isArray(userRoles) && userRoles.length > 0
    ? userRoles
    : role
      ? [role]
      : [];

  const have = new Set(haveList.map(normRole).filter(Boolean));

  // If no explicit roles required, just allow
  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override (optional)
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  // Pass if intersection of wanted ∩ have is not empty
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  // If user is an admin but not the right one, push to admin home
  if (Array.from(have).some((r) => r.includes("ADMIN"))) {
    return <Navigate to={adminHome} replace />;
  }

  // Otherwise back to public home
  return <Navigate to={publicHome} replace />;
}
