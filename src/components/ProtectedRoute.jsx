// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
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
 * Usage:
 *   <ProtectedRoute roles="SUPER_ADMIN"><Page/></ProtectedRoute>
 *   <ProtectedRoute roles={["THEATER_ADMIN"]}><Page/></ProtectedRoute>
 *   <ProtectedRoute roles={["SUPER_ADMIN", "THEATER_ADMIN"]}><Page/></ProtectedRoute>
 */
export default function ProtectedRoute({ children, roles }) {
  const { token, role, roles: userRoles } = useAuth();

  // Build the caller's required roles
  const wanted = normWanted(roles);

  // Figure out if the route is "admin-ish" based on required roles
  const wantsAdmin =
    wanted.size > 0
      ? Array.from(wanted).some((r) => r?.includes("ADMIN"))
      : false;

  // If not logged in → send to the correct login
  if (!token) {
    return <Navigate to={wantsAdmin ? "/admin/login" : "/login"} replace />;
  }

  // Gather the user's roles (prefer roles[], fallback to single role)
  const haveList = Array.isArray(userRoles) && userRoles.length > 0
    ? userRoles
    : role
      ? [role]
      : [];

  const have = new Set(haveList.map(normRole).filter(Boolean));

  // If no explicit roles required, just allow
  if (wanted.size === 0) return children;

  // SUPER_ADMIN override (enable/disable as you like)
  const SUPER_OVERRIDES = true;
  if (SUPER_OVERRIDES && have.has("SUPER_ADMIN")) {
    // allow SUPER_ADMIN into any admin-required route
    if (wantsAdmin) return children;
  }

  // Pass if intersection of wanted ∩ have is not empty
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children;

  // If user is an admin but not the right one, push to admin home
  if (Array.from(have).some((r) => r.includes("ADMIN"))) {
    return <Navigate to="/admin" replace />;
  }

  // Otherwise back to public home
  return <Navigate to="/" replace />;
}
