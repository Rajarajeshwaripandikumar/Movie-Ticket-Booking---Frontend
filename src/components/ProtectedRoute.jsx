// src/components/ProtectedRoute.jsx
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Map role aliases to canonical values */
const ROLE_ALIASES = {
  THEATRE_ADMIN: "THEATER_ADMIN", // spelling fix (British -> American)
  MANAGER: "THEATER_ADMIN",       // generic manager
  PVR_MANAGER: "THEATER_ADMIN",   // your case
  PVR_ADMIN: "THEATER_ADMIN",
};

/** Normalize a single role value to CANONICAL STRING */
function normRole(r) {
  if (r == null) return null;
  try {
    const v = String(r).trim().toUpperCase().replace(/\s+/g, "_");
    return ROLE_ALIASES[v] || v;
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

export default function ProtectedRoute({
  children,
  roles,                       // string | string[]
  requireAuth = true,          // if true, block unauthenticated even when roles not provided
  superOverrides = true,       // allow SUPER_ADMIN into any admin-only route
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin",
  publicHome = "/",
}) {
  const { token, role, roles: userRoles } = useAuth();
  const location = useLocation();

  const wanted = useMemo(() => normWanted(roles), [roles]);

  // Admin area detection: check both spellings
  const ADMIN_HINTS = ["ADMIN", "MANAGER", "THEATER", "THEATRE"];
  const wantsAdmin =
    wanted.size > 0
      ? Array.from(wanted).some((r) => ADMIN_HINTS.some((h) => r?.includes(h)))
      : false;

  // Not logged in
  if (!token) {
    if (!requireAuth && wanted.size === 0) return children ?? <Outlet />;
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Roles the user has (support single role or array)
  const haveList =
    Array.isArray(userRoles) && userRoles.length > 0
      ? userRoles
      : role
      ? [role]
      : [];
  const have = useMemo(() => new Set(haveList.map(normRole).filter(Boolean)), [haveList]);

  // If no specific roles required, but auth required, allow through
  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  // Regular role match
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  // Deny: route them sensibly
  if (Array.from(have).some((r) => r.includes("ADMIN") || r.includes("THEATER") || r.includes("THEATRE"))) {
    return <Navigate to={adminHome} replace />;
  }
  return <Navigate to={publicHome} replace />;
}

/* ---------- Convenience wrappers (nice DX) ---------- */

// Example:
// <AdminOnly><AdminShell /></AdminOnly>
// <TheatreAdminOnly><TheatreShell /></TheatreAdminOnly>

export function AdminOnly(props) {
  return <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]} {...props} />;
}

export function TheatreAdminOnly(props) {
  // allow SUPER_ADMIN to view theatre admin routes too
  return <ProtectedRoute roles={["THEATER_ADMIN", "SUPER_ADMIN"]} {...props} />;
}
