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

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || null;
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
      api.setAuthToken(token);
    } else {
      try {
        localStorage.removeItem("token");
      } catch {}
      api.setAuthToken(null);
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
      // Adjust path to match your backend
      const res = await api.post("/auth/login", { email, password, roleHint });
      const t = res?.data?.token;
      if (!t) throw new Error("No token returned from server");

      // decode claims from JWT (if present)
      const claims = decodeJwt(t) || {};

      // Role can come from many places
      const rawRoleFromJwt =
        claims.role ||
        (Array.isArray(claims.roles) ? claims.roles[0] : null) ||
        (Array.isArray(claims.authorities) ? claims.authorities[0] : null);

      const rawRoleFromBody =
        res?.data?.role ||
        res?.data?.user?.role ||
        (Array.isArray(res?.data?.user?.roles)
          ? res.data.user.roles[0]
          : null) ||
        (Array.isArray(res?.data?.user?.authorities)
          ? res.data.user.authorities[0]
          : null);

      const chosenRawRole = rawRoleFromJwt || rawRoleFromBody || roleHint || "USER";
      const derivedRole = normalizeRole(chosenRawRole);

      // theaterId / theatreId can also be in JWT or response
      const theaterId =
        claims.theaterId ||
        claims.theatreId ||
        res?.data?.user?.theaterId ||
        res?.data?.user?.theatreId ||
        null;

      const finalUser = {
        ...(res?.data?.user || {}),
        email: res?.data?.user?.email || claims.email || email,
        role: derivedRole,
        theaterId, // prefer US spelling in app state
      };

      setToken(t);
      setRole(derivedRole);
      setUser(finalUser);

      return { token: t, role: derivedRole, user: finalUser };
    } catch (err) {
      console.error("[Auth] login failed:", err);
      const msg = err?.response?.data?.message || err.message || "Login failed";
      throw new Error(msg);
    }
  }, []);

  /* ---------------- LOGOUT ---------------- */
  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setUser(null);
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
    } catch {}
    api.setAuthToken(null);
  }, []);

  /* ---------------- REFRESH PROFILE ---------------- */
  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      if (res?.data?.user) {
        const u = res.data.user;
        const nextRole = normalizeRole(
          u.role ||
            (Array.isArray(u.roles) ? u.roles[0] : null) ||
            (Array.isArray(u.authorities) ? u.authorities[0] : null) ||
            role
        );

        setUser({
          ...u,
          role: nextRole,
          theaterId: u.theaterId || u.theatreId || user?.theaterId || null,
        });
        setRole(nextRole);
      }
      return res?.data?.user || null;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      return null;
    }
  }, [logout, role, user?.theaterId]);

  /* ---------------- Derived flags ---------------- */
  const isLoggedIn = !!token;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || isSuperAdmin; // generic Admin flag
  const isTheatreAdmin = role === "THEATER_ADMIN"; // normalized
  const isUser = role === "USER";

  const value = useMemo(
    () => ({
      token,
      role,
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
