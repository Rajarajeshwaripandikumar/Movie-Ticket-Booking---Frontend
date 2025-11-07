// src/components/ProtectedRoute.jsx
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* -------------------------------- Roles ---------------------------------- */
/** Canonical role is THEATRE_ADMIN (UK spelling), but accept common aliases */
const ROLE_ALIASES = {
  THEATER_ADMIN: "THEATRE_ADMIN", // US -> canonical
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
  roles,                       // string | string[]
  requireAuth = true,          // block unauthenticated when true
  superOverrides = true,       // SUPER_ADMIN can pass any admin route
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin",
  publicHome = "/",
}) {
  const { token, role, roles: userRoles, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  const wanted = useMemo(() => normWanted(roles), [roles]);
  const wantsAdmin =
    wanted.size > 0 &&
    Array.from(wanted).some((r) => /ADMIN|MANAGER|THEATRE|THEATER/.test(r || ""));

  /* ✅ Do nothing while auth is hydrating to avoid false redirects */
  if (loading) return null; // or a Spinner component

  /* Not logged in (after hydration) */
  const authed = !!token || !!isAuthenticated;
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

  /* Normalize user roles */
  const haveList =
    Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : role ? [role] : [];
  const have = useMemo(() => new Set(haveList.map(normRole).filter(Boolean)), [haveList]);

  /* No specific roles required -> allow */
  if (wanted.size === 0) return children ?? <Outlet />;

  /* SUPER_ADMIN override for admin routes */
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  /* Regular role check */
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  /* Deny: route sensibly based on whether user is some kind of admin */
  const isSomeAdmin = Array.from(have).some((r) => /ADMIN|THEAT(RE|ER)/.test(r));
  return <Navigate to={isSomeAdmin ? adminHome : publicHome} replace />;
}

/* ----------------------- Convenience wrappers ---------------------------- */

export function AdminOnly(props) {
  // Admin pages: allow ADMIN and SUPER_ADMIN
  return <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]} {...props} />;
}

export function TheatreAdminOnly(props) {
  // Theatre-admin pages: allow THEATRE_ADMIN and SUPER_ADMIN
  return <ProtectedRoute roles={["THEATRE_ADMIN", "SUPER_ADMIN"]} {...props} />;
}
