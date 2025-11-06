// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../api/api";

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/* ---------------- helpers to decode jwt ---------------- */
function safeJsonBase64Decode(payload) {
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    const padded = normalized + (pad ? "=".repeat(4 - pad) : "");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  return safeJsonBase64Decode(parts[1]);
}

/* ---------------- normalize role helper ---------------- */
/** Normalizes role casing/spaces; strips ROLE_; maps theatre spellings/aliases. */
function normalizeRole(raw) {
  if (raw === undefined || raw === null) return null;
  try {
    // Accept objects like { authority: 'ROLE_ADMIN' } or { name: 'ADMIN' }
    const val =
      typeof raw === "object" && raw !== null
        ? raw.authority ?? raw.value ?? raw.name
        : raw;

    let v = String(val).trim().toUpperCase().replace(/\s+/g, "_");

    // Strip common prefix
    if (v.startsWith("ROLE_")) v = v.slice(5);

    // Treat any brand manager as theater admin (PVR_MANAGER, INOX_MANAGER, ...)
    if (/_MANAGER$/.test(v)) v = "THEATER_ADMIN";

    // Unify theatre/theater spellings & aliases
    if (v === "THEATRE_ADMIN" || v === "THEATRE_OWNER" || v === "THEATER_OWNER")
      v = "THEATER_ADMIN";

    // Allow SUPERADMIN spelling
    if (v === "SUPERADMIN") v = "SUPER_ADMIN";

    return v;
  } catch {
    return null;
  }
}

/* ---------------- default landing by role ---------------- */
function defaultLandingFor(role) {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN" || r === "ADMIN" || r === "THEATER_ADMIN") {
    return "/admin/dashboard";
  }
  return "/";
}

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      const t = localStorage.getItem("token");
      return typeof t === "string" && t ? t : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    try {
      const stored = localStorage.getItem("role");
      return stored ? normalizeRole(stored) : null;
    } catch {
      return null;
    }
  });

  const [roles, setRoles] = useState(() => {
    try {
      const raw = localStorage.getItem("roles");
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr.map(normalizeRole).filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  const [perms, setPerms] = useState(() => {
    try {
      const raw = localStorage.getItem("perms");
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  /* ---------------- Keep in sync ---------------- */
  useEffect(() => {
    if (token) {
      try {
        localStorage.setItem("token", token);
      } catch {}
      api.setAuthToken?.(token);
    } else {
      try {
        localStorage.removeItem("token");
      } catch {}
      api.setAuthToken?.(null);
    }
  }, [token]);

  useEffect(() => {
    if (role) {
      try {
        localStorage.setItem("role", role);
      } catch {}
    } else {
      try {
        localStorage.removeItem("role");
      } catch {}
    }
  }, [role]);

  useEffect(() => {
    try {
      if (roles?.length) localStorage.setItem("roles", JSON.stringify(roles));
      else localStorage.removeItem("roles");
    } catch {}
  }, [roles]);

  useEffect(() => {
    try {
      if (perms?.length) localStorage.setItem("perms", JSON.stringify(perms));
      else localStorage.removeItem("perms");
    } catch {}
  }, [perms]);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem("user", JSON.stringify(user));
      } catch {}
    } else {
      try {
        localStorage.removeItem("user");
      } catch {}
    }
  }, [user]);

  /* ---------------- LOGIN ---------------- */
  /**
   * login(email, password, roleHint?)
   * roleHint is optional and used as a fallback if server/JWT don't provide a role.
   */
  const login = useCallback(async (email, password, roleHint) => {
    if (!email || !password) throw new Error("Missing credentials");

    try {
      const res = await api.post("/auth/login", { email, password, roleHint });
      // Support axios-like { data } or bare response
      const data = res?.data ?? res;
      const t = data?.token;
      if (!t || typeof t !== "string") throw new Error("No token returned from server");

      // Decode claims from JWT (if present)
      const claims = decodeJwt(t) || {};

      // Role(s) from claims or body
      const roleCandidates = [
        claims.role,
        ...(Array.isArray(claims.roles) ? claims.roles : []),
        data?.role,
        data?.user?.role,
        ...(Array.isArray(data?.user?.roles) ? data.user.roles : []),
        ...(Array.isArray(data?.authorities) ? data.authorities : []),
        ...(Array.isArray(data?.user?.authorities) ? data.user.authorities : []),
        roleHint,
        "USER",
      ].filter(Boolean);

      const normalizedRoles = roleCandidates.map(normalizeRole).filter(Boolean);
      const derivedRole = normalizedRoles[0] || "USER";

      // Permissions (optional)
      const permsArr =
        (Array.isArray(claims.perms) && claims.perms) ||
        (Array.isArray(data?.perms) && data.perms) ||
        (Array.isArray(data?.user?.perms) && data.user.perms) ||
        [];

      // theaterId / theatreId from JWT or response
      const theaterId =
        claims.theaterId ??
        claims.theatreId ??
        data?.user?.theaterId ??
        data?.user?.theatreId ??
        null;

      const finalUser = {
        ...(data?.user || {}),
        email: data?.user?.email || claims.email || email,
        role: derivedRole,
        roles: normalizedRoles,
        perms: permsArr,
        theaterId, // prefer US spelling in app state
      };

      setToken(t);
      setRole(derivedRole);
      setRoles(normalizedRoles);
      setPerms(permsArr);
      setUser(finalUser);

      // --- redirect right after successful login
      const target = defaultLandingFor(derivedRole);
      // allow state/localStorage to settle before navigation
      setTimeout(() => {
        window.location.replace(target);
      }, 0);

      return { token: t, role: derivedRole, roles: normalizedRoles, perms: permsArr, user: finalUser };
    } catch (err) {
      console.error("[Auth] login failed:", err);
      const msg =
        err?.response?.data?.message ||
        err?.payload?.message ||
        err?.message ||
        "Login failed";
      throw new Error(msg);
    }
  }, []);

  /* ---------------- LOGOUT ---------------- */
  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setRoles([]);
    setPerms([]);
    setUser(null);
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("roles");
      localStorage.removeItem("perms");
      localStorage.removeItem("user");
    } catch {}
    api.setAuthToken?.(null);
    // Optional: send user to public home after logout
    setTimeout(() => {
      window.location.replace("/");
    }, 0);
  }, []);

  /* ---------------- REFRESH PROFILE ---------------- */
  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      const data = res?.data ?? res;

      if (data?.user) {
        const u = data.user;

        const roleCandidates = [
          u.role,
          ...(Array.isArray(u.roles) ? u.roles : []),
          ...(Array.isArray(u.authorities) ? u.authorities : []),
          role,
        ].filter(Boolean);

        const normalizedRoles = roleCandidates.map(normalizeRole).filter(Boolean);
        const nextRole = normalizedRoles[0] || role || "USER";

        const nextPerms =
          (Array.isArray(u.perms) && u.perms) ||
          (Array.isArray(data?.perms) && data.perms) ||
          perms;

        setUser({
          ...u,
          role: nextRole,
          roles: normalizedRoles,
          perms: nextPerms,
          theaterId: u.theaterId || u.theatreId || user?.theaterId || null,
        });
        setRole(nextRole);
        setRoles(normalizedRoles);
        setPerms(nextPerms);
      }
      return data?.user || null;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      return null;
    }
  }, [logout, role, perms, user?.theaterId]);

  /* ---------------- Derived flags ---------------- */
  const isLoggedIn = !!token;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || isSuperAdmin; // generic Admin flag
  const isTheatreAdmin = role === "THEATER_ADMIN"; // normalized
  const isUser = role === "USER";

  /* ---------------- Auto-redirect on load/refresh ---------------- */
  useEffect(() => {
    if (!isLoggedIn) return;
    const target = defaultLandingFor(role);
    const here = window.location.pathname;
    // Auto-bounce from generic entry points
    if ((here === "/" || here === "/login" || here === "/admin") && here !== target) {
      window.location.replace(target);
    }
  }, [isLoggedIn, role]);

  const value = useMemo(
    () => ({
      token,
      role,
      roles,
      perms,
      user,
      setUser,
      login,
      logout,
      refreshProfile,
      isLoggedIn,
      isSuperAdmin,
      isAdmin,
      isTheatreAdmin,
      isUser,
    }),
    [
      token,
      role,
      roles,
      perms,
      user,
      login,
      logout,
      refreshProfile,
      isLoggedIn,
      isSuperAdmin,
      isAdmin,
      isTheatreAdmin,
      isUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
