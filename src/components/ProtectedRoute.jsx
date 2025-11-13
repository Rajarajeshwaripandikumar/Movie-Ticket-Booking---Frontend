// src/components/ProtectedRoute.jsx
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* -------------------------------- Roles ---------------------------------- */
const ROLE_ALIASES = {
  THEATER_ADMIN: "THEATRE_ADMIN",
  MANAGER: "THEATRE_ADMIN",
  PVR_MANAGER: "THEATRE_ADMIN",
  PVR_ADMIN: "THEATRE_ADMIN",
  SUPERADMIN: "SUPER_ADMIN",
};

function normRole(r) {
  if (r == null) return null;
  let v = String(r).trim().toUpperCase().replace(/\s+/g, "_");
  if (v.startsWith("ROLE_")) v = v.slice(5);
  return ROLE_ALIASES[v] || v;
}

function normWanted(roles) {
  if (!roles) return new Set();
  const arr = Array.isArray(roles) ? roles : [roles];
  return new Set(arr.map(normRole).filter(Boolean));
}

/* ------------------------------ Guard ------------------------------------ */
export default function ProtectedRoute({
  children,
  roles, // string | string[]
  requireAuth = true,
  superOverrides = true,
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin",
  publicHome = "/",
}) {
  // NOTE: your AuthContext exposes token, adminToken, isLoggedIn, role, roles
  const { token, adminToken, role, roles: userRoles, isLoggedIn } = useAuth();
  const location = useLocation();

  const wanted = useMemo(() => normWanted(roles), [roles]);
  const wantsAdmin =
    wanted.size > 0 &&
    Array.from(wanted).some((r) => /ADMIN|MANAGER|THEATRE|THEATER/.test(r || ""));

  // If your context has a loading flag in future, use it. For now assume ready.
  const loading = false;

  if (loading) return null;

  // Active auth check: consider adminToken OR token OR context flag
  const authed = !!isLoggedIn || !!adminToken || !!token;
  if (!authed) {
    if (!requireAuth && wanted.size === 0) return children ?? <Outlet />;
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Normalize user roles (prefer userRoles array then role scalar)
  const haveList =
    Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : role ? [role] : [];
  const have = useMemo(() => new Set(haveList.map(normRole).filter(Boolean)), [haveList]);

  // No role required -> allow
  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override for admin routes
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  // Regular role check
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  // Deny: sensible fallback route
  const isSomeAdmin = Array.from(have).some((r) => /ADMIN|THEAT(RE|ER)/.test(r));
  return <Navigate to={isSomeAdmin ? adminHome : publicHome} replace />;
}

/* ----------------------- Convenience wrappers ---------------------------- */

export function AdminOnly(props) {
  return <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]} {...props} />;
}

export function TheatreAdminOnly(props) {
  return <ProtectedRoute roles={["THEATRE_ADMIN", "SUPER_ADMIN"]} {...props} />;
}
