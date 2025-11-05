// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Map role aliases to canonical values */
const ROLE_ALIASES = {
  THEATRE_ADMIN: "THEATER_ADMIN", // spelling fix
  MANAGER: "THEATER_ADMIN",       // generic manager
  PVR_MANAGER: "THEATER_ADMIN",   // your case
  PVR_ADMIN: "THEATER_ADMIN",
};

/** Normalize a single role string */
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
  superOverrides = true,       // allow SUPER_ADMIN to enter any admin-only route
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin",
  publicHome = "/",
}) {
  const { token, role, roles: userRoles } = useAuth();
  const location = useLocation();

  const wanted = normWanted(roles);

  // Treat anything with ADMIN/MANAGER/THEATER in it as an admin area
  const ADMIN_HINTS = ["ADMIN", "MANAGER", "THEATER"];
  const wantsAdmin =
    wanted.size > 0
      ? Array.from(wanted).some((r) => ADMIN_HINTS.some((h) => r?.includes(h)))
      : false;

  if (!token) {
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  const haveList =
    Array.isArray(userRoles) && userRoles.length > 0
      ? userRoles
      : role
      ? [role]
      : [];
  const have = new Set(haveList.map(normRole).filter(Boolean));

  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override (optional)
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  if (Array.from(have).some((r) => r.includes("ADMIN") || r.includes("THEATER"))) {
    return <Navigate to={adminHome} replace />;
  }

  return <Navigate to={publicHome} replace />;
}
