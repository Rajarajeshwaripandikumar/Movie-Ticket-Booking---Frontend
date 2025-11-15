import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Normalizing roles function
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
  const {
    token,
    adminToken,
    role,
    roles: userRoles,
    isLoggedIn,
    initialized,
    loading,
  } = useAuth();

  const location = useLocation();

  // Normalize the requested roles
  const wanted = useMemo(() => normWanted(roles), [roles]);

  const wantsAdmin =
    wanted.size > 0 &&
    Array.from(wanted).some((r) => /ADMIN|MANAGER|THEATRE|THEATER/.test(r || ""));

  // Initialization gating
  const authInitializing =
    loading === true || typeof initialized === "undefined" || initialized === false;

  if (authInitializing) {
    return null; // Or display a spinner
  }

  // Check if the user is authenticated
  const authed = !!isLoggedIn || (!!adminToken && adminToken !== "null") || (!!token && token !== "null");

  // If not authenticated and we're not on the login page, redirect to login
  if (!authed) {
    // If no authentication is required and no specific roles, allow access
    if (!requireAuth && wanted.size === 0) return children ?? <Outlet />;

    // Skip the redirect if we are already on login page
    if (location.pathname === adminLoginPath) {
      return children ?? <Outlet />;
    }

    // Redirect to login page
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Normalized user roles from context
  const have = useMemo(() => {
    const list = Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : role ? [role] : [];
    return new Set(list.map(normRole).filter(Boolean));
  }, [role, userRoles]);

  // If no specific role required, allow access
  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  // Regular role check
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  // Deny: redirect to the proper home based on the roles
  const isSomeAdmin = Array.from(have).some((r) => /ADMIN|THEAT(RE|ER)/.test(r));
  return <Navigate to={isSomeAdmin ? adminHome : publicHome} replace />;
}

export function AdminOnly(props) {
  return <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]} {...props} />;
}

export function TheatreAdminOnly(props) {
  return <ProtectedRoute roles={["THEATRE_ADMIN", "SUPER_ADMIN"]} {...props} />;
}
