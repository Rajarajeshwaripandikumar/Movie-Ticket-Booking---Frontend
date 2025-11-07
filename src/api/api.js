import axios from "axios";

/* -------------------------------- BASE URL -------------------------------- */
const RAW_BASE =
  (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com";

function normalizeHost(h) {
  if (!h) return "";
  return h.toLowerCase().trim().replace(/\/+$/, "");
}
export const BASE_URL = normalizeHost(RAW_BASE);
const API_PREFIX = "/api";
export const AXIOS_BASE = `${BASE_URL}${API_PREFIX}`;

// Heads-up for common typo in the backend hostname (o1m2 vs 0lm2)
if (RAW_BASE.toLowerCase().includes("-0lm2.")) {
  console.warn(
    "[api] WARNING: VITE_API_BASE looks like '0lm2' (zero + ell). " +
      "Your deployment is 'o1m2' (letter-o + one):",
    RAW_BASE
  );
}

/* --------------------------- Role canonicalization ------------------------ */
function canonRole(r) {
  if (!r && r !== "") return "";
  const raw =
    typeof r === "object" && r !== null ? r.authority ?? r.value ?? r.name ?? "" : r;
  let v = String(raw).toUpperCase().trim().replace(/\s+/g, "_");
  if (v.startsWith("ROLE_")) v = v.slice(5);

  // ✅ Do not remap ADMIN → SUPER_ADMIN
  // ✅ Canonicalize various admin labels to THEATRE_ADMIN (UK spelling used app-wide)
  const map = {
    SUPERADMIN: "SUPER_ADMIN",
    THEATER_ADMIN: "THEATRE_ADMIN",
    THEATRE_MANAGER: "THEATRE_ADMIN",
    THEATER_MANAGER: "THEATRE_ADMIN",
    PVR_MANAGER: "THEATRE_ADMIN",
    PVR_ADMIN: "THEATRE_ADMIN",
    MANAGER: "THEATRE_ADMIN",
  };
  return map[v] ?? v;
}

/* ---------------------- Token retrieval + cookie helper ------------------- */
function readCookie(name) {
  try {
    const cookie = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + "="));
    if (!cookie) return null;
    return decodeURIComponent(cookie.split("=")[1]);
  } catch {
    return null;
  }
}

/**
 * Attempts to find an auth token + role across common storage locations.
 * Checks explicit admin/user keys, consolidated "auth" JSON, aliases, cookies,
 * and finally the axios default header as a last resort.
 */
function getAuthFromStorage() {
  try {
    // 1) Explicit keys set by our AuthContext / backend responses
    const adminToken =
      localStorage.getItem("adminToken") ||
      sessionStorage.getItem("adminToken");
    const userToken =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const topRole =
      localStorage.getItem("role") ||
      sessionStorage.getItem("role");

    if (adminToken || userToken) {
      return { token: adminToken || userToken, role: topRole };
    }

    // 2) Consolidated "auth" JSON used elsewhere
    const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token =
          parsed?.token ||
          parsed?.accessToken ||
          parsed?.jwt ||
          parsed?.user?.token;
        const role =
          parsed?.role ||
          parsed?.user?.role ||
          (Array.isArray(parsed?.roles) ? parsed.roles[0] : undefined);
        if (token) return { token, role };
      } catch {}
    }

    // 3) Other token aliases
    for (const k of [
      "jwt",
      "accessToken",
      "authToken",
      "auth_token",
      "access_token",
      "bearer",
    ]) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return { token: v, role: topRole || undefined };
    }

    // 4) Cookie fallbacks
    const cookieToken =
      readCookie("adminToken") ||
      readCookie("token") ||
      readCookie("jwt") ||
      readCookie("accessToken");
    if (cookieToken) return { token: cookieToken, role: topRole || undefined };

    // 5) Last resort: axios default header (if primed elsewhere)
    const authHeader = api?.defaults?.headers?.common?.Authorization;
    if (typeof authHeader === "string") {
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (m) return { token: m[1], role: topRole || undefined };
    }
  } catch {}
  return { token: null, role: undefined };
}

/* ------------------------------ Origin helpers --------------------------- */
function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}
const BASE_ORIGIN = originOf(BASE_URL);
const SELF_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";
export const SAME_ORIGIN = BASE_ORIGIN && SELF_ORIGIN && BASE_ORIGIN === SELF_ORIGIN;

// Feature flag: allow sending the role header even on cross-origin (defaults false)
const SEND_ROLE_HEADER = String(import.meta.env?.VITE_SEND_ROLE_HEADER || "false").toLowerCase() === "true";

/* ------------------------------ Axios instance --------------------------- */
const api = axios.create({
  baseURL: AXIOS_BASE, // callers pass paths WITHOUT "/api" (e.g., "/admin/me")
  timeout: 60000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

// Keep FormData content-type dynamic; let browser set boundaries
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((m) => {
    if (api.defaults.headers[m]) delete api.defaults.headers[m]["Content-Type"];
  });
}

/* ----------------------- Request interceptor (JWT) ------------------------ */
export const API_DEBUG = true;
const DEV_TOKEN_FALLBACK =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.DEV || import.meta.env?.VITE_DEV_TOKEN_FALLBACK === "true")) ||
  false;

// manual override (e.g., post-login priming)
let _manualToken = null;

api.setAuthToken = (token) => {
  _manualToken = token || null;
  if (token) {
    api.defaults.headers.common = api.defaults.headers.common || {};
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else if (api.defaults.headers.common) {
    delete api.defaults.headers.common.Authorization;
  }
};

// 1) Attach token and (conditionally) x-role if same-origin or opted-in
api.interceptors.request.use((config) => {
  try {
    const { token, role } = getAuthFromStorage();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization)
        config.headers.Authorization = `Bearer ${token}`;

      // Only send role header when safe to do so
      const normalizedRole = canonRole(role);
      const allowRoleHeader = SAME_ORIGIN || SEND_ROLE_HEADER;

      // Normalize header name to lowercase to minimize CORS issues
      if (allowRoleHeader && normalizedRole) {
        delete config.headers["X-Role"]; // remove any legacy casing
        config.headers["x-role"] = normalizedRole;
      } else {
        // ensure we DO NOT send the role header on cross-origin requests
        delete config.headers["X-Role"];
        delete config.headers["x-role"];
      }

      if (API_DEBUG && String(config.url || "").includes("/analytics/")) {
        console.debug("[api] analytics request with auth →", {
          url: config.url,
          hasAuth: !!config.headers.Authorization,
          role: allowRoleHeader ? normalizedRole : "(suppressed for CORS)",
          sameOrigin: SAME_ORIGIN,
        });
      }
    } else if (API_DEBUG && String(config.url || "").includes("/analytics/")) {
      console.warn("[api] NO TOKEN for analytics request", config.url);
    }
  } catch {}
  return config;
});

// 2) Ensure manually-set token (via setAuthToken) is honored if header missing
api.interceptors.request.use((config) => {
  if (_manualToken && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${_manualToken}`;
  }
  return config;
});

// 3) Rescue analytics first paint: use ?token= fallback or DEV param attach
api.interceptors.request.use((config) => {
  try {
    const isAnalytics = String(config.url || "").includes("/analytics/");
    const hasAuth = !!(config.headers && config.headers.Authorization);
    if (isAnalytics && !hasAuth) {
      const tokenFromUrl = new URLSearchParams(window.location.search).get("token");
      if (tokenFromUrl) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${tokenFromUrl}`;
        if (API_DEBUG) console.warn("[api] using ?token= from URL for analytics");
      } else if (DEV_TOKEN_FALLBACK) {
        const { token } = getAuthFromStorage();
        if (token) {
          config.params = { ...(config.params || {}), token }; // adds ?token=
          if (API_DEBUG) console.warn("[api] added ?token= fallback for analytics", config.url);
        }
      }
    }
  } catch {}
  return config;
});

/* -------------------------- Response interceptor (401) -------------------- */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/* ---------------------- Convenience helpers (404→null) -------------------- */
api.safeGet = async (url, cfg) => {
  try {
    const res = await api.get(url, cfg);
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
};

api.safeDelete = async (url, cfg) => {
  try {
    const res = await api.delete(url, cfg);
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
};

/* ------------------------------- Helper utils ----------------------------- */
export function extractApiError(err) {
  const server = err?.response?.data;
  return (
    (server && (server.message || server.error || server.details)) ||
    (server && typeof server === "string" ? server : null) ||
    `HTTP ${err?.response?.status ?? ""} ${err?.message ?? "Request failed"}`
  );
}

export function apiUrl(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${clean}`;
}

export function makeAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads") || url.includes("/uploads/")) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

/* ----------------------------- Post-login hook ---------------------------- */
// Smarter priming: set the correct storage keys so guards & Navbar agree
export function primeAuth(token, role) {
  try {
    const canonical = canonRole(role);
    if (canonical === "SUPER_ADMIN" || canonical === "ADMIN" || canonical === "THEATRE_ADMIN") {
      localStorage.setItem("adminToken", token);
    } else {
      localStorage.setItem("token", token);
    }
    if (canonical) localStorage.setItem("role", canonical);

    localStorage.setItem("auth", JSON.stringify({ token, role: canonical || role }));
    api.setAuthToken(token); // prime axios instance immediately
    if (API_DEBUG) console.debug("[api] primeAuth set", { role: canonical, sameOrigin: SAME_ORIGIN });
  } catch (e) {
    console.error("[api] primeAuth failed:", e);
  }
}

/* ------------------------- Startup hydration (NEW) ------------------------ */
// If the user was already logged in, carry Authorization on first paint
(() => {
  try {
    const { token } = getAuthFromStorage();
    if (token) api.setAuthToken(token);
  } catch {}
})();

export default api;
export { canonRole, getAuthFromStorage };
