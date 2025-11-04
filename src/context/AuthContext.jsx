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
function normalizeRole(raw) {
  if (!raw && raw !== "") return null;
  try {
    return String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  } catch {
    return null;
  }
}

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem("token") || null; } catch { return null; }
  });
  const [role, setRole] = useState(() => {
    try { return normalizeRole(localStorage.getItem("role")) || null; } catch { return null; }
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
      try { localStorage.setItem("token", token); } catch {}
      api.setAuthToken(token);
    } else {
      try { localStorage.removeItem("token"); } catch {}
      api.setAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (role) {
      try { localStorage.setItem("role", role); } catch {}
    } else {
      try { localStorage.removeItem("role"); } catch {}
    }
  }, [role]);

  useEffect(() => {
    if (user) {
      try { localStorage.setItem("user", JSON.stringify(user)); } catch {}
    } else {
      try { localStorage.removeItem("user"); } catch {}
    }
  }, [user]);

  /* ---------------- LOGIN ---------------- */
  /**
   * login(email, password, roleHint?)
   * roleHint is optional and used as fallback if server/JWT don't provide a role.
   */
  const login = useCallback(async (email, password, roleHint) => {
    if (!email || !password) throw new Error("Missing credentials");

    try {
      // call your API - adjust path if your backend uses a different route
      const res = await api.post("/auth/login", { email, password, roleHint });
      const t = res?.data?.token;
      if (!t) throw new Error("No token returned from server");

      // decode the JWT for claims (if available)
      const claims = decodeJwt(t) || {};

      // try multiple places the server might return role
      const rawRoleFromJwt = claims.role || claims?.roles?.[0];
      const rawRoleFromBody = res?.data?.role || res?.data?.user?.role;
      const chosenRawRole = rawRoleFromJwt || rawRoleFromBody || roleHint || "USER";

      const derivedRole = normalizeRole(chosenRawRole);
      const theatreId = claims.theatreId || res?.data?.user?.theatreId || null;

      const finalUser = {
        ...(res.data.user || {}),
        role: derivedRole,
        theatreId,
      };

      // persist in state (effects will sync to localStorage & api.setAuthToken)
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
    try { localStorage.removeItem("token"); } catch {}
    try { localStorage.removeItem("role"); } catch {}
    try { localStorage.removeItem("user"); } catch {}
    api.setAuthToken(null);
  }, []);

  /* ---------------- REFRESH PROFILE ---------------- */
  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      if (res?.data?.user) {
        setUser(res.data.user);
        setRole(normalizeRole(res.data.user.role));
      }
      return res?.data?.user || null;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      return null;
    }
  }, [logout]);

  /* ---------------- Derived flags ---------------- */
  const isLoggedIn = !!token;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isTheatreAdmin = role === "THEATRE_ADMIN";
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
      isTheatreAdmin,
      isUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
