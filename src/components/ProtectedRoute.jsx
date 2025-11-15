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
/**
 * ProtectedRoute wrapper for React Router v6.
 * (keeps same props you had)
 */
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
  // Prefer canonical flags from AuthContext
  // NOTE: AuthContext should expose:
  //   - isLoggedIn (boolean) -> true only after token/user validated
  //   - loading (boolean) -> true while verifying/hydrating
  //   - initialized (boolean|null|undefined) -> true once initial check done
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

  // normalize the requested roles
  const wanted = useMemo(() => normWanted(roles), [roles]);

  // guess whether requested roles are admin-like (used for choosing login target)
  const wantsAdmin =
    wanted.size > 0 &&
    Array.from(wanted).some((r) => /ADMIN|MANAGER|THEATRE|THEATER/.test(r || ""));

  /* ------------------ Initialization gating (make it conservative) ------------------
   - We consider auth "still initializing" unless `initialized === true` OR
     there is an explicit `loading` flag that is false and `isLoggedIn` is present.
   - Treat undefined/null/false `initialized` as still initializing.
   - This avoids making auth decisions based purely on token presence.
  */
  const authInitializing =
    loading === true || typeof initialized === "undefined" || initialized === false;

  // while initializing, render nothing (or a spinner) to avoid redirects
  if (authInitializing) {
    // You can replace null with a small spinner component if you want UI feedback.
    return null;
  }

  // Active auth check:
  // Prefer a canonical isLoggedIn boolean (should be set only after validation).
  // Falling back to tokens is a last resort — but we keep a defensive check.
  const authed = !!isLoggedIn || (!!adminToken && adminToken !== "null") || (!!token && token !== "null");

  if (!authed) {
    // If auth is not required and no specific role is requested, allow public access
    if (!requireAuth && wanted.size === 0) return children ?? <Outlet />;

    // Redirect to login and preserve `from` so the login page can redirect back
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  // Build a normalized set of user roles from context values
  const have = useMemo(() => {
    const list =
      Array.isArray(userRoles) && userRoles.length > 0
        ? userRoles
        : role
        ? [role]
        : [];
    return new Set(list.map(normRole).filter(Boolean));
  }, [role, userRoles]);

  // If no specific role required, allow access
  if (wanted.size === 0) return children ?? <Outlet />;

  // SUPER_ADMIN override: allow SUPER_ADMIN access to admin-like areas
  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) return children ?? <Outlet />;
  }

  // Regular role check
  const canAccess = Array.from(wanted).some((w) => have.has(w));
  if (canAccess) return children ?? <Outlet />;

  // Deny: redirect user to sensible home based on their roles
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
