// src/routes/ProtectedRoute.jsx (or src/components/ProtectedRoute.jsx)
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ---------------- Role normalization ---------------- */

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

/* ---------------- Main guard component ---------------- */

export default function ProtectedRoute({
  children,
  roles, // string | string[]
  requireAuth = true,
  superOverrides = true,
  loginPath = "/login",
  adminLoginPath = "/admin/login",
  adminHome = "/admin/dashboard",
  publicHome = "/",
}) {
  const auth = useAuth() || {};

  const {
    user,
    role,
    roles: userRoles,
    isAuthenticated,
    isLoggedIn, // in case some older code uses this
    isLoading,
    initialized,
  } = auth;

  const location = useLocation();

  // Normalize the requested roles
  const wanted = useMemo(() => normWanted(roles), [roles]);

  // Does this route look “admin-ish” based on required roles?
  const wantsAdmin =
    wanted.size > 0 &&
    Array.from(wanted).some((r) =>
      /ADMIN|MANAGER|THEATRE|THEATER/.test(r || "")
    );

  /* ----------- Initialization / loading gating ----------- */

  const authInitializing =
    (typeof isLoading !== "undefined" && isLoading) ||
    (typeof initialized !== "undefined" && initialized === false);

  if (authInitializing) {
    // You can render a loader/spinner here instead of null if you like
    return null;
  }

  /* ----------- Auth check ----------- */

  // Prefer isAuthenticated, fall back to isLoggedIn if present
  const authed =
    typeof isAuthenticated !== "undefined"
      ? !!isAuthenticated
      : !!isLoggedIn;

  // Debug logs to see what's going on
  console.log("[ProtectedRoute] path:", location.pathname);
  console.log("[ProtectedRoute] authed:", authed);
  console.log("[ProtectedRoute] user:", user);
  console.log("[ProtectedRoute] role:", role);
  console.log("[ProtectedRoute] userRoles:", userRoles);
  console.log("[ProtectedRoute] wanted:", Array.from(wanted));

  if (!authed) {
    // If no auth required & no specific roles, just let it through
    if (!requireAuth && wanted.size === 0) {
      return children ?? <Outlet />;
    }

    // If we are already *on* the relevant login page, don't redirect again
    if (
      location.pathname === adminLoginPath ||
      location.pathname === loginPath
    ) {
      return children ?? <Outlet />;
    }

    // Redirect to login (admin vs public)
    return (
      <Navigate
        to={wantsAdmin ? adminLoginPath : loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  /* ----------- Normalize current user roles ----------- */

  const have = useMemo(() => {
    // prefer roles from user object if present
    const fromUser =
      user && (user.roles || (user.role ? [user.role] : []));

    const rawList =
      (Array.isArray(fromUser) && fromUser.length > 0 && fromUser) ||
      (Array.isArray(userRoles) && userRoles.length > 0 && userRoles) ||
      (role ? [role] : []);

    return new Set((rawList || []).map(normRole).filter(Boolean));
  }, [user, role, userRoles]);

  console.log("[ProtectedRoute] have roles:", Array.from(have));

  // If no specific roles required, any logged-in user can access
  if (wanted.size === 0) {
    return children ?? <Outlet />;
  }

  /* ----------- SUPER_ADMIN override ----------- */

  if (superOverrides && have.has("SUPER_ADMIN")) {
    if (wantsAdmin) {
      console.log("[ProtectedRoute] SUPER_ADMIN override allowed");
      return children ?? <Outlet />;
    }
  }

  /* ----------- Regular role check ----------- */

  const canAccess = Array.from(wanted).some((w) => have.has(w));
  console.log("[ProtectedRoute] canAccess:", canAccess);

  if (canAccess) {
    return children ?? <Outlet />;
  }

  /* ----------- Deny → redirect to appropriate home ----------- */

  const isSomeAdmin = Array.from(have).some((r) =>
    /ADMIN|THEAT(RE|ER)/.test(r)
  );

  console.log(
    "[ProtectedRoute] access denied, redirect →",
    isSomeAdmin ? adminHome : publicHome
  );

  return <Navigate to={isSomeAdmin ? adminHome : publicHome} replace />;
}

/* ------------- Convenience wrappers ------------- */

export function AdminOnly(props) {
  // If your system only has SUPER_ADMIN + THEATRE_ADMIN, you can tweak this
  return <ProtectedRoute roles={["SUPER_ADMIN"]} {...props} />;
}

export function TheatreAdminOnly(props) {
  return (
    <ProtectedRoute
      roles={["THEATRE_ADMIN", "SUPER_ADMIN"]}
      {...props}
    />
  );
}
