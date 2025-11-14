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

/* ---------------- helpers to decode jwt (safe) ---------------- */
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
    if (/_MANAGER$/.test(v)) v = "THEATRE_ADMIN";
    if (["THEATER_ADMIN", "THEATRE_OWNER", "THEATER_OWNER"].includes(v))
      v = "THEATRE_ADMIN";
    if (v === "SUPERADMIN") v = "SUPER_ADMIN";

    return v;
  } catch {
    return null;
  }
}

function defaultLandingFor(role) {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN") return "/admin/dashboard";
  if (r === "THEATRE_ADMIN") return "/theatre/my"; // <-- corrected to match App.jsx
  if (r === "ADMIN") return "/admin/dashboard";
  return "/";
}

/* ---------------- localStorage helpers ---------------- */
const LS_KEYS = {
  token: "token",
  adminToken: "adminToken",
  role: "role",
  roles: "roles",
  perms: "perms",
  user: "user",
  activeSession: "activeSession",
};
function writeJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
function readJSON(k, fallback) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  // tokens
  const [token, setToken] = useState(() => localStorage.getItem(LS_KEYS.token));
  const [adminToken, setAdminToken] = useState(() =>
    localStorage.getItem(LS_KEYS.adminToken)
  );

  const [role, setRole] = useState(() =>
    normalizeRole(localStorage.getItem(LS_KEYS.role))
  );
  const [roles, setRoles] = useState(() => {
    const raw = readJSON(LS_KEYS.roles, []);
    return Array.isArray(raw) ? raw.map(normalizeRole).filter(Boolean) : [];
  });

  const [perms, setPerms] = useState(() => {
    const raw = readJSON(LS_KEYS.perms, []);
    return Array.isArray(raw) ? raw.map(String) : [];
  });

  const [user, setUser] = useState(() => readJSON(LS_KEYS.user, null));

  const [initialized, setInitialized] = useState(false);

  // activeSession: "admin" | "user" — persisted, choose which token is applied to axios
  const [activeSession, setActiveSession] = useState(() =>
    localStorage.getItem(LS_KEYS.activeSession) || (localStorage.getItem(LS_KEYS.adminToken) ? "admin" : "user")
  );

  // compute the active token (explicit session switch)
  const activeToken = activeSession === "admin" ? adminToken || token : token || adminToken || null;

  /* Set axios header according to activeToken */
  useEffect(() => {
    if (activeToken) {
      api.setAuthToken?.(activeToken);
      if (api.defaults)
        api.defaults.headers.common.Authorization = `Bearer ${activeToken}`;
    } else {
      api.setAuthToken?.(null);
      if (api.defaults) delete api.defaults.headers.common.Authorization;
    }
    // persist session choice
    try {
      localStorage.setItem(LS_KEYS.activeSession, activeSession);
    } catch {}
  }, [activeToken, activeSession]);

  /* Persist tokens */
  useEffect(() => {
    token
      ? localStorage.setItem(LS_KEYS.token, token)
      : localStorage.removeItem(LS_KEYS.token);
  }, [token]);

  useEffect(() => {
    adminToken
      ? localStorage.setItem(LS_KEYS.adminToken, adminToken)
      : localStorage.removeItem(LS_KEYS.adminToken);
  }, [adminToken]);

  /* Persist role, roles, perms, user */
  useEffect(() => {
    role
      ? localStorage.setItem(LS_KEYS.role, role)
      : localStorage.removeItem(LS_KEYS.role);
  }, [role]);

  useEffect(() => {
    roles?.length
      ? writeJSON(LS_KEYS.roles, roles)
      : localStorage.removeItem(LS_KEYS.roles);
  }, [roles]);

  useEffect(() => {
    perms?.length
      ? writeJSON(LS_KEYS.perms, perms)
      : localStorage.removeItem(LS_KEYS.perms);
  }, [perms]);

  useEffect(() => {
    user ? writeJSON(LS_KEYS.user, user) : localStorage.removeItem(LS_KEYS.user);
  }, [user]);

  /* Init identity on first load */
  useEffect(() => {
    const rawAdmin = localStorage.getItem(LS_KEYS.adminToken);
    const rawUser = localStorage.getItem(LS_KEYS.token);
    const persistedSession = localStorage.getItem(LS_KEYS.activeSession);

    // prefer persisted session if present
    if (persistedSession) setActiveSession(persistedSession);

    // if admin token exists and session prefers admin, initialize admin
    if (rawAdmin) {
      const claims = decodeJwt(rawAdmin) || {};
      const r = normalizeRole(claims.role);
      if (r) {
        setAdminToken(rawAdmin);
        // only set token null if admin session should be primary; otherwise keep both
        if (!rawUser) setToken(null);

        setRole(r);
        setRoles([r]);

        setUser({
          email: claims.email,
          role: r,
          roles: [r],
          perms: claims.perms || [],
          theaterId: claims.theatreId || claims.theaterId || null,
        });

        setInitialized(true);
        return;
      } else {
        localStorage.removeItem(LS_KEYS.adminToken);
      }
    }

    if (rawUser) {
      const claims = decodeJwt(rawUser) || {};
      const r = normalizeRole(claims.role);
      if (r) {
        setToken(rawUser);
        setRole(r);
        setRoles([r]);
        setUser({
          email: claims.email,
          role: r,
          roles: [r],
          perms: claims.perms || [],
          theaterId: claims.theatreId || claims.theaterId || null,
        });
      } else {
        localStorage.removeItem(LS_KEYS.token);
      }
    }

    setInitialized(true);
  }, []);

  /* Login (USER) */
  const login = useCallback(async (email, password, roleHint) => {
    const res = await api.post("/api/auth/login", {
      email,
      password,
      roleHint,
    });
    const data = res?.data;

    const t = data?.token;
    const claims = decodeJwt(t) || {};

    const roleCandidates = [
      claims.role,
      ...(Array.isArray(claims.roles) ? claims.roles : []),
      data?.user?.role,
      "USER",
    ].filter(Boolean);

    const finalRole = normalizeRole(roleCandidates[0]);
    const finalUser = {
      ...data.user,
      role: finalRole,
      roles: [finalRole],
      perms: claims.perms || [],
      theaterId: claims.theatreId || claims.theaterId || null,
    };

    // clear admin session when logging in as user (keep adminToken if you want both; here we favor single active)
    setAdminToken(null);
    setToken(t);
    setActiveSession("user");
    setRole(finalRole);
    setRoles([finalRole]);
    setPerms(finalUser.perms);
    setUser(finalUser);

    writeJSON(LS_KEYS.user, finalUser);
    localStorage.setItem(LS_KEYS.token, t);
    localStorage.removeItem(LS_KEYS.adminToken);

    setInitialized(true);
    setTimeout(() => window.location.replace(defaultLandingFor(finalRole)), 0);
  }, []);

  /* Login (ADMIN) */
  const loginAdmin = useCallback(async (email, password) => {
    let res;
    try {
      res = await api.post("/api/auth/admin/login", { email, password });
    } catch {
      res = await api.post("/api/auth/admin-login", { email, password });
    }

    const data = res?.data;
    const t = data?.adminToken || data?.token;
    const claims = decodeJwt(t) || {};

    const finalRole = normalizeRole(
      claims.role || data?.user?.role || "ADMIN"
    );

    const finalUser = {
      ...data.user,
      email: claims.email || email,
      role: finalRole,
      roles: [finalRole],
      perms: claims.perms || [],
      theaterId: claims.theatreId || claims.theaterId || null,
    };

    // keep user token separate but set active session to admin
    setToken(null); // optional: clear user token to avoid ambiguity
    setAdminToken(t);
    setActiveSession("admin");
    setRole(finalRole);
    setRoles([finalRole]);
    setPerms(finalUser.perms);
    setUser(finalUser);

    localStorage.setItem(LS_KEYS.adminToken, t);
    localStorage.setItem(LS_KEYS.role, finalRole);
    writeJSON(LS_KEYS.user, finalUser);

    setInitialized(true);
    setTimeout(() => window.location.replace(defaultLandingFor(finalRole)), 0);
  }, []);

  /* Logout */
  const logout = useCallback(() => {
    setToken(null);
    setAdminToken(null);
    setRole(null);
    setRoles([]);
    setPerms([]);
    setUser(null);
    setActiveSession("user");

    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));

    api.setAuthToken?.(null);
    if (api.defaults) delete api.defaults.headers.common.Authorization;

    setInitialized(true);
    setTimeout(() => window.location.replace("/"), 0);
  }, []);

  /* Refresh profile */
  const refreshProfile = useCallback(
    async () => {
      try {
        if (!activeToken) return null;

        const path = activeSession === "admin" ? "/api/admin/me" : "/api/auth/me";
        const res = await api.get(path);
        const u = res?.data?.user || res?.data;

        const nextRole = normalizeRole(u.role);
        const nextUser = {
          ...u,
          role: nextRole,
          roles: [nextRole],
          perms:
            u.perms ||
            res?.data?.perms ||
            perms,
          theaterId: u.theaterId || u.theatreId || null,
        };

        setUser(nextUser);
        setRole(nextRole);
        setRoles([nextRole]);
        setPerms(nextUser.perms);

        return nextUser;
      } catch (err) {
        if (err?.response?.status === 401) logout();
        return null;
      }
    },
    [activeToken, activeSession, perms, logout]
  );

  /* Derived flags */
  const isLoggedIn = !!activeToken;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN";
  const isTheatreAdmin = role === "THEATRE_ADMIN";
  const isAdminLike = isAdmin || isSuperAdmin || isTheatreAdmin;

  /* ---------- FIXED REDIRECT LOGIC (safe) ---------- */
  useEffect(() => {
    if (!initialized) return;

    if (isLoggedIn && role) {
      const here = window.location.pathname;
      const target = defaultLandingFor(role);

      // Only redirect from public login pages (NOT arbitrary admin children)
      if (
        (here === "/" ||
          here === "/login" ||
          here === "/admin/login") &&
        here !== target
      ) {
        window.location.replace(target);
      }
    }
  }, [initialized, isLoggedIn, role]);

  const value = useMemo(
    () => ({
      token,
      adminToken,
      activeToken,
      activeSession,
      setActiveSession,
      role,
      roles,
      perms,
      user,
      setUser,
      initialized,
      isLoggedIn,
      isSuperAdmin,
      isAdmin,
      isTheatreAdmin,
      isAdminLike,
      hasRole: (r) => role === r,
      hasAnyRole: (...rs) => rs.some((r) => r === role),
      login,
      loginAdmin,
      logout,
      refreshProfile,
    }),
    [
      token,
      adminToken,
      activeToken,
      activeSession,
      role,
      roles,
      perms,
      user,
      initialized,
      isLoggedIn,
      isSuperAdmin,
      isAdmin,
      isTheatreAdmin,
      isAdminLike,
      login,
      loginAdmin,
      logout,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
