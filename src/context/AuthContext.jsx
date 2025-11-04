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

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [role, setRole] = useState(() => localStorage.getItem("role") || null);
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
      localStorage.setItem("token", token);
      api.setAuthToken(token);
    } else {
      localStorage.removeItem("token");
      api.setAuthToken(null);
    }
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem("role", role);
    else localStorage.removeItem("role");
  }, [role]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  /* ---------------- LOGIN ---------------- */
  const login = useCallback(async (email, password) => {
    if (!email || !password) throw new Error("Missing credentials");

    try {
      const res = await api.post("/auth/login", { email, password });
      const t = res?.data?.token;
      if (!t) throw new Error("No token returned from server");

      // decode the JWT
      const claims = decodeJwt(t) || {};
      const derivedRole = String(claims.role || res?.data?.user?.role || "USER").toUpperCase();
      const theatreId = claims.theatreId || res?.data?.user?.theatreId || null;

      const finalUser = {
        ...res.data.user,
        role: derivedRole,
        theatreId,
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
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
  }, []);

  /* ---------------- REFRESH PROFILE ---------------- */
  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      if (res?.data?.user) {
        setUser(res.data.user);
        setRole(String(res.data.user.role).toUpperCase());
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
