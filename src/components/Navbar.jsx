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

/* ---------------- helpers to decode jwt (safe, no atob errors) ---------------- */
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

/* ---------------- normalize role helper (canonical: THEATRE_ADMIN) ---------------- */
function normalizeRole(raw) {
  if (raw === undefined || raw === null) return null;
  try {
    const val =
      typeof raw === "object" && raw !== null
        ? raw.authority ?? raw.value ?? raw.name
        : raw;

    let v = String(val).trim().toUpperCase().replace(/\s+/g, "_");

    // strip Spring prefix
    if (v.startsWith("ROLE_")) v = v.slice(5);

    // Map managers/owners and US spelling to canonical UK spelling
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
  if (r === "THEATRE_ADMIN") return "/admin"; // send theatre admins into admin shell
  if (r === "ADMIN") return "/admin/dashboard";
  return "/";
}

/* ---------------- small storage helpers ---------------- */
const LS_KEYS = {
  token: "token", // normal user token
  adminToken: "adminToken", // admin-only token
  role: "role",
  roles: "roles",
  perms: "perms",
  user: "user",
};

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- AuthProvider ---------------- */
export function AuthProvider({ children }) {
  // Keep BOTH tokens; prefer adminToken for protected/admin API calls & identity
  const [token, setToken] = useState(() => localStorage.getItem(LS_KEYS.token) || null);
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem(LS_KEYS.adminToken) || null
  );

  const [role, setRole] = useState(() => normalizeRole(localStorage.getItem(LS_KEYS.role)));
  const [roles, setRoles] = useState(() => {
    const raw = readJSON(LS_KEYS.roles, []);
    return Array.isArray(raw) ? raw.map(normalizeRole).filter(Boolean) : [];
  });

  const [perms, setPerms] = useState(() => {
    const raw = readJSON(LS_KEYS.perms, []);
    return Array.isArray(raw) ? raw.map(String) : [];
  });

  const [user, setUser] = useState(() => readJSON(LS_KEYS.user, null));

  // whether auth finished its initial load. Consumers should wait for this before redirecting.
  const [initialized, setInitialized] = useState(false);

  // Compute the active auth token (admin has priority)
  const activeToken = adminToken || token || null;

  /* Sync active token -> axios header and localStorage */
  useEffect(() => {
    // Use api.setAuthToken which your api.js exposes
    try {
      api.setAuthToken?.(activeToken);
      if (activeToken) {
        // also keep axios defaults in sync (api.setAuthToken does this)
        if (api.defaults) api.defaults.headers.common.Authorization = `Bearer ${activeToken}`;
      } else {
        if (api.defaults) delete api.defaults.headers.common.Authorization;
      }
    } catch {}
  }, [activeToken]);

  // Persist each token separately
  useEffect(() => {
    if (token) localStorage.setItem(LS_KEYS.token, token);
    else localStorage.removeItem(LS_KEYS.token);
  }, [token]);

  useEffect(() => {
    if (adminToken) localStorage.setItem(LS_KEYS.adminToken, adminToken);
    else localStorage.removeItem(LS_KEYS.adminToken);
  }, [adminToken]);

  /* Persist role/roles/perms/user whenever they change */
  useEffect(() => {
    if (role) localStorage.setItem(LS_KEYS.role, role);
    else localStorage.removeItem(LS_KEYS.role);
  }, [role]);

  useEffect(() => {
    if (roles?.length) writeJSON(LS_KEYS.roles, roles);
    else localStorage.removeItem(LS_KEYS.roles);
  }, [roles]);

  useEffect(() => {
    if (perms?.length) writeJSON(LS_KEYS.perms, perms);
    else localStorage.removeItem(LS_KEYS.perms);
  }, [perms]);

  useEffect(() => {
    if (user) writeJSON(LS_KEYS.user, user);
    else localStorage.removeItem(LS_KEYS.user);
  }, [user]);

  /* Initialize identity on first load (prefer admin token) */
  useEffect(() => {
    const rawAdmin = localStorage.getItem(LS_KEYS.adminToken);
    const rawUser = localStorage.getItem(LS_KEYS.token);

    if (rawAdmin) {
      const claims = decodeJwt(rawAdmin) || {};
      const r = normalizeRole(claims.role);
      if (r) {
        setAdminToken(rawAdmin);
        setToken(null); // ensure clean separation
        setRole(r);
        setRoles([r]);
        setUser({
          email: claims.email || user?.email || "",
          role: r,
          roles: [r],
          perms: Array.isArray(claims.perms) ? claims.perms : [],
          theaterId: claims.theatreId || claims.theaterId || user?.theaterId || null,
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
          email: claims.email || user?.email || "",
          role: r,
          roles: [r],
          perms: Array.isArray(claims.perms) ? claims.perms : [],
          theaterId: claims.theatreId || claims.theaterId || user?.theaterId || null,
        });
      } else {
        localStorage.removeItem(LS_KEYS.token);
      }
    }

    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Listen for global 401 events from api.js and logout (defensive) */
  useEffect(() => {
    const onUnauth = () => {
      // eslint-disable-next-line no-console
      console.warn("[AuthContext] received api:unauthorized — logging out");
      logout();
    };
    window.addEventListener("api:unauthorized", onUnauth);
    return () => window.removeEventListener("api:unauthorized", onUnauth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* USER LOGIN (normal site login) */
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

    // set state: USER token only, clear admin token if present
    setAdminToken(null);
    setToken(t);
    setRole(finalRole);
    setRoles(normalizedRoles);
    setPerms(permsArr);
    setUser(finalUser);

    // storage
    localStorage.setItem(LS_KEYS.token, t);
    localStorage.removeItem(LS_KEYS.adminToken);
    localStorage.setItem(LS_KEYS.role, finalRole);
    writeJSON(LS_KEYS.roles, normalizedRoles);
    writeJSON(LS_KEYS.perms, permsArr);
    writeJSON(LS_KEYS.user, finalUser);

    // prime axios header
    api.setAuthToken?.(t);

    setInitialized(true);
    setTimeout(() => window.location.replace(defaultLandingFor(finalRole)), 0);
  }, []);

  /* ADMIN LOGIN (SUPER_ADMIN / THEATRE_ADMIN / ADMIN) */
  const loginAdmin = useCallback(async (email, password) => {
    // Try slash route first, then hyphen fallback under /api/auth
    let res;
    try {
      res = await api.post("/auth/admin/login", { email, password });
    } catch {
      res = await api.post("/auth/admin-login", { email, password });
    }
    const data = res?.data ?? res;
    const t = data?.adminToken || data?.token;
    if (!t || typeof t !== "string") throw new Error("No admin token returned from server");

    const claims = decodeJwt(t) || {};
    const finalRole =
      normalizeRole(claims.role) ||
      normalizeRole(data?.role) ||
      normalizeRole(data?.user?.role) ||
      "ADMIN";

    const permsArr =
      (Array.isArray(claims.perms) && claims.perms) ||
      (Array.isArray(data?.user?.perms) && data.user.perms) ||
      [];

    const finalUser = {
      ...(data?.user || {}),
      email: data?.user?.email || claims.email || email,
      role: finalRole,
      roles: [finalRole],
      perms: permsArr,
      theaterId: claims.theatreId || claims.theaterId || data?.user?.theatreId || null,
    };

    // set state: ADMIN token only, clear user token if present
    setToken(null);
    setAdminToken(t);
    setRole(finalRole);
    setRoles([finalRole]);
    setPerms(permsArr);
    setUser(finalUser);

    // storage
    localStorage.setItem(LS_KEYS.adminToken, t);
    localStorage.removeItem(LS_KEYS.token);
    localStorage.setItem(LS_KEYS.role, finalRole);
    writeJSON(LS_KEYS.roles, [finalRole]);
    writeJSON(LS_KEYS.perms, permsArr);
    writeJSON(LS_KEYS.user, finalUser);

    // prime axios header
    api.setAuthToken?.(t);

    setInitialized(true);
    setTimeout(() => window.location.replace(defaultLandingFor(finalRole)), 0);
  }, []);

  /* LOGOUT */
  const logout = useCallback(() => {
    setToken(null);
    setAdminToken(null);
    setRole(null);
    setRoles([]);
    setPerms([]);
    setUser(null);

    // remove only our keys
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));

    api.setAuthToken?.(null);
    if (api.defaults) delete api.defaults.headers.common.Authorization;

    // mark initialized so guards don't keep waiting; user is known to be logged out
    setInitialized(true);

    setTimeout(() => window.location.replace("/"), 0);
  }, []);

  /* REFRESH PROFILE — uses whichever token is active (admin preferred) */
  const refreshProfile = useCallback(
    async () => {
      try {
        if (!activeToken) return null;

        // if adminToken is active, call admin profile endpoint; otherwise call unified auth/me
        const profilePath = adminToken ? "/admin/me" : "/auth/me";
        // NOTE: api.baseURL already includes /api (see src/api/api.js)
        const res = await api.get(profilePath);

        const u = res?.data?.user ?? res?.data; // adapt if backend returns user directly
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

        const nextUser = {
          ...u,
          role: nextRole,
          roles: normalizedRoles,
          perms: nextPerms,
          theaterId: u.theaterId || u.theatreId || user?.theaterId || null,
        };

        setUser(nextUser);
        setRole(nextRole);
        setRoles(normalizedRoles);
        setPerms(nextPerms);

        return nextUser;
      } catch (err) {
        if (err?.response?.status === 401) {
          logout();
        }
        return null;
      }
    },
    // include adminToken in deps so closure sees it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeToken, adminToken, logout, role, perms, user]
  );

  /* Derived flags */
  const isLoggedIn = !!activeToken;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN"; // literal ADMIN only
  const isTheatreAdmin = role === "THEATRE_ADMIN";
  const isUser = role === "USER";

  // Any admin-like role (what your guards should use)
  const isAdminLike = isSuperAdmin || isTheatreAdmin || isAdmin;

  /* RBAC helpers */
  const hasRole = useCallback((r) => role === r, [role]);
  const hasAnyRole = useCallback((...rs) => rs.some((r) => r && r === role), [role]);

  /* Who can open the admin shell (panel) */
  const canOpenAdminPanel = isAdminLike;

  /* Redirect on load (only when logged in) — wait for initialization */
  useEffect(() => {
    if (!initialized) return; // WAIT until we know auth state

    if (isLoggedIn && role) {
      const here = window.location.pathname;
      const target = defaultLandingFor(role);
      if (
        (here === "/" ||
          here === "/login" ||
          here === "/admin" ||
          here === "/admin/login") &&
        here !== target
      ) {
        window.location.replace(target);
      }
    }
  }, [initialized, isLoggedIn, role]);

  /* Context value */
  const value = useMemo(
    () => ({
      // raw tokens (optional debugging)
      token,
      adminToken,

      // identity
      role,
      roles,
      perms,
      user,
      setUser,

      // actions
      login, // user login (/api/auth/login)
      loginAdmin, // admin login (/api/auth/admin-login or /api/auth/admin/login)
      logout,
      refreshProfile,

      // flags
      initialized, // consumers should wait until this is true before redirecting
      isLoggedIn,
      isSuperAdmin,
      isAdmin, // literal ADMIN
      isTheatreAdmin,
      isAdminLike,
      isUser,
      canOpenAdminPanel,

      // rbac helpers
      hasRole,
      hasAnyRole,
    }),
    [
      token,
      adminToken,
      role,
      roles,
      perms,
      user,
      login,
      loginAdmin,
      logout,
      refreshProfile,
      initialized,
      isLoggedIn,
      isSuperAdmin,
      isAdmin,
      isTheatreAdmin,
      isAdminLike,
      isUser,
      canOpenAdminPanel,
      hasRole,
      hasAnyRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
