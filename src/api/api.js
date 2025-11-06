// frontend/src/api/api.js
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
  const map = {
    ADMIN: "SUPER_ADMIN",
    SUPERADMIN: "SUPER_ADMIN",
    THEATRE_ADMIN: "THEATER_ADMIN",
    THEATRE_MANAGER: "THEATER_ADMIN",
    THEATER_MANAGER: "THEATER_ADMIN",
    PVR_MANAGER: "THEATER_ADMIN",
    PVR_ADMIN: "THEATER_ADMIN",
    MANAGER: "THEATER_ADMIN",
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

function getAuthFromStorage() {
  try {
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
    for (const k of ["token", "jwt", "accessToken", "authToken"]) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return { token: v, role: undefined };
    }
    const cookieToken =
      readCookie("token") || readCookie("jwt") || readCookie("accessToken");
    if (cookieToken) return { token: cookieToken, role: undefined };
  } catch {}
  return { token: null, role: undefined };
}

/* ------------------------------ Axios instance --------------------------- */
const api = axios.create({
  baseURL: AXIOS_BASE,
  timeout: 60000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

// keep FormData content-type dynamic
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((m) => {
    if (api.defaults.headers[m]) delete api.defaults.headers[m]["Content-Type"];
  });
}

/* ----------------------- Request interceptor (JWT) ------------------------ */
const API_DEBUG = true; // ⬅️ enable temporarily to see what's happening

api.interceptors.request.use((config) => {
  try {
    const { token, role } = getAuthFromStorage();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization)
        config.headers.Authorization = `Bearer ${token}`;

      const normalizedRole = canonRole(role);
      if (normalizedRole && !config.headers["X-Role"]) {
        config.headers["X-Role"] = normalizedRole;
      }
      if (API_DEBUG) {
        // Log for analytics calls specifically
        if (String(config.url || "").includes("/analytics/")) {
          console.debug("[api] analytics request with auth →", {
            url: config.url,
            hasAuth: !!config.headers.Authorization,
            role: normalizedRole,
          });
        }
      }
    } else if (API_DEBUG) {
      if (String(config.url || "").includes("/analytics/")) {
        console.warn("[api] NO TOKEN for analytics request", config.url);
      }
    }
  } catch {}
  return config;
});

/* ----------------------- Programmatic token setter ------------------------ */
let _manualToken = null;
api.setAuthToken = (token) => {
  _manualToken = token;
  if (token) {
    api.defaults.headers.common = api.defaults.headers.common || {};
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else if (api.defaults.headers.common) {
    delete api.defaults.headers.common.Authorization;
  }
};

// ensure manual token gets applied if present
api.interceptors.request.use((config) => {
  if (_manualToken && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${_manualToken}`;
  }
  return config;
});

/* ---- DEV-ONLY emergency fallback: add ?token= if header still missing ---- */
// This uses your backend’s tokenQueryToHeader to avoid 401s while you diagnose.
// Remove or gate behind an env flag for production if you don't want it.
api.interceptors.request.use((config) => {
  try {
    const isAnalytics = String(config.url || "").includes("/analytics/");
    const hasAuth = !!(config.headers && config.headers.Authorization);
    if (isAnalytics && !hasAuth) {
      const { token } = getAuthFromStorage();
      if (token) {
        config.params = { ...(config.params || {}), token }; // ⬅️ adds ?token=
        if (API_DEBUG) {
          console.warn("[api] added ?token= fallback for analytics", config.url);
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
    return `${BASE_URL}${url}`; // uploads live outside /api
  }
  return url;
}

/* ----------------------------- Post-login hook ---------------------------- */
// Call this right after a successful login to guarantee future requests are authed.
export function primeAuth(token, role) {
  try {
    const payload = {
      token,
      role: role ?? undefined,
    };
    localStorage.setItem("auth", JSON.stringify(payload));
    api.setAuthToken(token); // prime axios instance immediately
    if (API_DEBUG) console.debug("[api] primeAuth set");
  } catch (e) {
    console.error("[api] primeAuth failed:", e);
  }
}

/* -------------------------------------------------------------------------- */
export default api;
