// src/context/AuthContext.jsx
import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import api from "../api/api";

/**
 * Auth context
 */
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

  // keep localStorage in sync when token/role/user change
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (role) localStorage.setItem("role", role);
    else localStorage.removeItem("role");
  }, [role]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    } catch {
      // ignore storage errors
    }
  }, [user]);

  /**
   * login(email, password, roleParam)
   */
  const login = useCallback(async (email, password, roleParam = "USER") => {
    if (!email || !password) {
      throw new Error("Missing credentials");
    }

    const isAdmin = String(roleParam || "USER").toUpperCase() === "ADMIN";
    let url = isAdmin ? "/auth/admin/login" : "/auth/login";
    const payload = { email, password };

    console.log("[Auth] login() start", { email, roleParam, url });

    try {
      const res = await api.post(url, payload);
      console.log("[Auth] login response", res?.status, res?.data);

      const t = res?.data?.token || res?.data?.accessToken || null;
      if (!t) {
        throw new Error(res?.data?.message || "No token returned from server");
      }

      setToken(t);

      // determine role
      let resolvedRole = null;
      if (res?.data?.user?.role) {
        resolvedRole = String(res.data.user.role).toUpperCase();
      } else if (res?.data?.role) {
        resolvedRole = String(res.data.role).toUpperCase();
      } else if (isAdmin) {
        resolvedRole = "ADMIN";
      } else {
        const claims = decodeJwt(t) || {};
        if (claims?.role) resolvedRole = String(claims.role).toUpperCase();
        else if (Array.isArray(claims?.roles) && claims.roles.includes("ADMIN")) resolvedRole = "ADMIN";
        else resolvedRole = "USER";
      }
      resolvedRole = resolvedRole === "ROLE_ADMIN" || resolvedRole === "ADMIN" ? "ADMIN" : "USER";
      setRole(resolvedRole);

      const u = res?.data?.user || { email, role: resolvedRole };
      setUser(u);

      return { token: t, role: resolvedRole, user: u };
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.message || "Login failed";
      console.error("[Auth] login error", { url, status, serverMsg, err });

      const serverAskedAdmin = String(serverMsg || "").toLowerCase().includes("/admin/login");
      if (isAdmin && url !== "/auth/admin/login" && serverAskedAdmin) {
        try {
          console.warn("[Auth] retrying admin endpoint /auth/admin/login (server suggested it)");
          const retryRes = await api.post("/auth/admin/login", payload);
          console.log("[Auth] retry response", retryRes?.status, retryRes?.data);

          const t2 = retryRes?.data?.token || retryRes?.data?.accessToken || null;
          if (!t2) throw new Error(retryRes?.data?.message || "No token returned on retry");

          setToken(t2);

          let resolvedRole2 = null;
          if (retryRes?.data?.user?.role) resolvedRole2 = String(retryRes.data.user.role).toUpperCase();
          else {
            const claims = decodeJwt(t2) || {};
            if (claims?.role) resolvedRole2 = String(claims.role).toUpperCase();
            else resolvedRole2 = "ADMIN";
          }
          resolvedRole2 = resolvedRole2 === "ROLE_ADMIN" || resolvedRole2 === "ADMIN" ? "ADMIN" : "USER";
          setRole(resolvedRole2);

          const u2 = retryRes?.data?.user || { email, role: resolvedRole2 };
          setUser(u2);

          return { token: t2, role: resolvedRole2, user: u2 };
        } catch (retryErr) {
          console.error("[Auth] admin retry failed", retryErr?.response || retryErr?.message || retryErr);
          throw new Error(retryErr?.response?.data?.message || retryErr?.message || "Admin login retry failed");
        }
      }

      if (status === 403 && String(serverMsg || "").toLowerCase().includes("please login via /admin/login")) {
        throw new Error("This account is an admin — please use the Admin login page.");
      }

      throw new Error(serverMsg);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setUser(null);
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
    } catch {
      // ignore
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/profile");
      if (res?.data?.user) setUser(res.data.user);
      return res?.data?.user || null;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      return null;
    }
  }, [logout]);

  // 🔑 Derived flags for navbar/routing
  const isLoggedIn = !!token;
  const isAdmin = role === "ADMIN";

  const value = useMemo(
    () => ({
      token,
      role,
      user,
      setUser,
      login,
      logout,
      refreshProfile,
      isLoggedIn, // <-- new
      isAdmin,    // <-- new
    }),
    [token, role, user, login, logout, refreshProfile, isLoggedIn, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
