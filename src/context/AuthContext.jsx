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
  if (raw === undefined || raw === null) return null;
  try {
    const val =
      typeof raw === "object" && raw !== null
        ? raw.authority ?? raw.value ?? raw.name
        : raw;

    let v = String(val).trim().toUpperCase().replace(/\s+/g, "_");

    if (v.startsWith("ROLE_")) v = v.slice(5);
    if (/_MANAGER$/.test(v)) v = "THEATER_ADMIN";
    if (["THEATRE_ADMIN", "THEATRE_OWNER", "THEATER_OWNER"].includes(v))
      v = "THEATER_ADMIN";
    if (v === "SUPERADMIN") v = "SUPER_ADMIN";

    return v;
  } catch {
    return null;
  }
}

function defaultLandingFor(role) {
  const r = normalizeRole(role);

  if (r === "SUPER_ADMIN" || r === "ADMIN") return "/admin/dashboard";
  if (r === "THEATER_ADMIN") return "/theatre/my";
  return "/";
}


/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [role, setRole] = useState(() => normalizeRole(localStorage.getItem("role")));
  const [roles, setRoles] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("roles"));
      return Array.isArray(raw) ? raw.map(normalizeRole).filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  const [perms, setPerms] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("perms"));
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  /* Sync localStorage + token header */
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      api.setAuthToken?.(token);
    } else {
      localStorage.removeItem("token");
      api.setAuthToken?.(null);
    }
  }, [token]);

  /* LOGIN */
  const login = useCallback(async (email, password, roleHint) => {
    const res = await api.post("/auth/login", { email, password, roleHint });
    const data = res?.data ?? res;
    const t = data?.token;
    if (!t || typeof t !== "string") throw new Error("No token returned from server");

    const claims = decodeJwt(t) || {};

    const roleCandidates = [
      claims.role,
      ...(Array.isArray(claims.roles) ? claims.roles : []),
      data?.role,
      data?.user?.role,
      ...(Array.isArray(data?.user?.roles) ? data.user.roles : []),
      roleHint,
      "USER",
    ].filter(Boolean);

    const normalizedRoles = roleCandidates.map(normalizeRole).filter(Boolean);
    const finalRole = normalizedRoles[0] || "USER";

    const permsArr =
      (Array.isArray(claims.perms) && claims.perms) ||
      (Array.isArray(data?.user?.perms) && data.user.perms) ||
      [];

    const finalUser = {
      ...(data?.user || {}),
      email: data?.user?.email || claims.email || email,
      role: finalRole,
      roles: normalizedRoles,
      perms: permsArr,
      theaterId: claims.theatreId || claims.theaterId || data?.user?.theaterId || null,
    };

    setToken(t);
    setRole(finalRole);
    setRoles(normalizedRoles);
    setPerms(permsArr);
    setUser(finalUser);

    setTimeout(() => window.location.replace(defaultLandingFor(finalRole)), 0);
  }, []);

  /* LOGOUT */
  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setRoles([]);
    setPerms([]);
    setUser(null);
    localStorage.clear();
    api.setAuthToken?.(null);
    setTimeout(() => window.location.replace("/"), 0);
  }, []);

  /* REFRESH PROFILE — ✅ STABILIZED */
  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      const u = res?.data?.user;
      if (!u) return null;

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
        (Array.isArray(res?.data?.perms) && res.data.perms) ||
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

      return u;
    } catch (err) {
      if (err?.response?.status === 401) logout();
      return null;
    }
  }, [logout]); // ✅ only depends on logout now

  /* Derived flags */
  const isLoggedIn = !!token;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || isSuperAdmin;
  const isTheatreAdmin = role === "THEATER_ADMIN";
  const isUser = role === "USER";

  /* Redirect on load */
  useEffect(() => {
    if (isLoggedIn) {
      const here = window.location.pathname;
      const target = defaultLandingFor(role);
      if ((here === "/" || here === "/login" || here === "/admin") && here !== target) {
        window.location.replace(target);
      }
    }
  }, [isLoggedIn, role]);

  /* ✅ Context value stable now */
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
