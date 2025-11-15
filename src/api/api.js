// src/api/api.js — full updated (includes DEV debug interceptors + startup hydration preview)
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

  // Keep mapping centralized
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

function getAuthFromStorage() {
  try {
    // explicit keys
    const adminToken =
      localStorage.getItem("adminToken") || sessionStorage.getItem("adminToken");
    const userToken =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    const topRole =
      localStorage.getItem("role") || sessionStorage.getItem("role");

    if (adminToken || userToken) {
      return { token: adminToken || userToken, role: topRole };
    }

    // consolidated "auth" JSON
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

    // other aliases
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

    // cookie fallbacks
    const cookieToken =
      readCookie("adminToken") ||
      readCookie("token") ||
      readCookie("jwt") ||
      readCookie("accessToken");
    if (cookieToken) return { token: cookieToken, role: topRole || undefined };
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

/* ----------------------- Cookie-first / credentials flag ----------------- */
// If VITE_COOKIE_AUTH=true then we enable withCredentials and prefer cookie-based refresh
const COOKIE_AUTH = String(import.meta.env?.VITE_COOKIE_AUTH || "false").toLowerCase() === "true";

/* ------------------------------ Axios instance --------------------------- */
const api = axios.create({
  baseURL: AXIOS_BASE,
  timeout: 60000,
  withCredentials: COOKIE_AUTH, // cookie-first option
  headers: { Accept: "application/json" },
});

// Endpoints that must NEVER be served from cache
const NO_STORE_ENDPOINTS = [
  /\/notifications\/mine(?:$|\?)/,
  /\/notifications\/\w+\/read(?:$|\?)/,
];

// Keep FormData content-type dynamic
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((m) => {
    if (api.defaults.headers[m]) delete api.defaults.headers[m]["Content-Type"];
  });
}

/* ----------------------- Request interceptor (cache-bust) ---------------- */
const API_DEBUG = !(typeof import.meta !== "undefined" && import.meta.env?.PROD);

// manual override token
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

function isNoStoreRequest(config) {
  const url = String(config?.url || "");
  return NO_STORE_ENDPOINTS.some((re) => re.test(url));
}

api.interceptors.request.use((config) => {
  try {
    if (String(config.method || "get").toLowerCase() === "get" && isNoStoreRequest(config)) {
      config.headers = config.headers || {};
      delete config.headers["If-None-Match"];
      delete config.headers["If-Modified-Since"];
      config.params = { ...(config.params || {}), _ts: Date.now() };

      if (API_DEBUG) {
        console.debug("[api] fresh GET →", { url: config.url, params: config.params });
      }
    }
  } catch {}
  return config;
});

/* ----------------- DEV DEBUG INTERCEPTORS (added) ----------------- */
if (API_DEBUG) {
  api.interceptors.request.use((cfg) => {
    try {
      console.debug("[api:DEBUG] OUTGOING", {
        method: String(cfg.method || "get").toLowerCase(),
        url: cfg.baseURL ? `${cfg.baseURL}${cfg.url || ""}` : cfg.url,
        headers: { ...(cfg.headers || {}) },
        withCredentials: cfg.withCredentials,
        params: cfg.params,
      });
    } catch (e) {}
    return cfg;
  });

  api.interceptors.response.use(
    (res) => {
      try {
        console.debug("[api:DEBUG] RESPONSE", {
          url: res.config?.url,
          status: res.status,
          headers: res.headers,
          dataPreview:
            typeof res.data === "object"
              ? JSON.stringify(res.data).slice(0, 300)
              : String(res.data).slice(0, 300),
        });
      } catch (e) {}
      return res;
    },
    (err) => {
      try {
        console.debug("[api:DEBUG] RESPONSE ERROR", {
          url: err?.config?.url,
          status: err?.response?.status,
          respHeaders: err?.response?.headers,
          respDataPreview:
            err?.response?.data && typeof err.response.data === "object"
              ? JSON.stringify(err.response.data).slice(0, 300)
              : String(err?.response?.data).slice(0, 300),
          message: err?.message,
        });
      } catch (e) {}
      return Promise.reject(err);
    }
  );
}

/* ----------------------- Request interceptor (attach auth) --------------- */
api.interceptors.request.use((config) => {
  try {
    const { token, role } = getAuthFromStorage();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;

      const normalizedRole = canonRole(role);
      const allowRoleHeader = SAME_ORIGIN || SEND_ROLE_HEADER;
      if (allowRoleHeader && normalizedRole) {
        delete config.headers["X-Role"];
        config.headers["x-role"] = normalizedRole;
      } else {
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

// Ensure manually-set token honored if header missing
api.interceptors.request.use((config) => {
  if (_manualToken && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${_manualToken}`;
  }
  return config;
});

// Analytics token fallback: ?token= or DEV fallback
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
      } else if (typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DEV_TOKEN_FALLBACK === "true")) {
        const { token } = getAuthFromStorage();
        if (token) {
          config.params = { ...(config.params || {}), token };
          if (API_DEBUG) console.warn("[api] added ?token= fallback for analytics", config.url);
        }
      }
    }
  } catch {}
  return config;
});

/* ----------------------- Refresh-token flow (401 handling) -------------- */
/**
 * Refresh-flow design:
 * - on first 401 we attempt a single refresh via `${BASE_URL}${API_PREFIX}/auth/refresh`
 * - we run refresh withCredentials: true (cookie-based refresh preferred)
 * - while refresh runs, subsequent requests are queued and retried with new token
 * - if refresh fails, we emit "api:unauthorized" and reject queued requests
 */
let isRefreshing = false;
let refreshQueue = []; // functions: (err, token) => void
async function runRefresh() {
  // Avoid calling through axios instance interceptors — use plain axios to avoid infinite loops
  const refreshUrl = `${BASE_URL}${API_PREFIX}/auth/refresh`;
  try {
    // If COOKIE_AUTH is enabled, request will include credentials
    const resp = await axios.post(refreshUrl, {}, { withCredentials: true, timeout: 20000 });
    // Expect resp.data.token or resp.data.accessToken etc.
    const newToken = resp?.data?.token || resp?.data?.accessToken || null;
    if (newToken) {
      api.setAuthToken(newToken);
      // persist via primeAuth minimal (do not overwrite role)
      try {
        const role = (getAuthFromStorage().role) ?? resp?.data?.role;
        if (newToken) {
          localStorage.setItem("auth", JSON.stringify({ token: newToken, role: role ?? "" }));
        }
      } catch {}
    }
    return newToken;
  } catch (e) {
    if (API_DEBUG) console.warn("[api] refresh failed", e);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const orig = error?.config;
    try {
      // if no config or already retried, propagate
      if (!orig || orig._retry) {
        if (error?.response?.status === 401) {
          window.dispatchEvent(new CustomEvent("api:unauthorized"));
        }
        return Promise.reject(error);
      }

      // Only attempt refresh for 401 and for requests that are not refresh itself
      if (error?.response?.status === 401 && !String(orig.url || "").includes("/auth/refresh")) {
        if (isRefreshing) {
          // queue: will be retried once refresh resolves
          return new Promise((resolve, reject) => {
            refreshQueue.push((err, token) => {
              if (err) return reject(err);
              orig._retry = true;
              if (token) orig.headers = orig.headers || {}, (orig.headers.Authorization = `Bearer ${token}`);
              resolve(api.request(orig));
            });
          });
        }

        isRefreshing = true;
        return new Promise(async (resolve, reject) => {
          try {
            const newToken = await runRefresh();
            isRefreshing = false;
            if (!newToken) {
              // flush queue with error
              refreshQueue.forEach((cb) => cb(new Error("refresh_failed")));
              refreshQueue = [];
              window.dispatchEvent(new CustomEvent("api:unauthorized"));
              return reject(error);
            }
            // flush queue with token
            refreshQueue.forEach((cb) => cb(null, newToken));
            refreshQueue = [];

            orig._retry = true;
            orig.headers = orig.headers || {};
            orig.headers.Authorization = `Bearer ${newToken}`;
            resolve(api.request(orig));
          } catch (e) {
            isRefreshing = false;
            refreshQueue.forEach((cb) => cb(e));
            refreshQueue = [];
            window.dispatchEvent(new CustomEvent("api:unauthorized"));
            reject(e);
          }
        });
      }

      if (error?.response?.status === 401) {
        window.dispatchEvent(new CustomEvent("api:unauthorized"));
      }
    } catch (e) {
      // swallow
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

/* ----------------------------- Convenience JSON helpers ------------------ */
api.postJson = async (url, body, cfg = {}) => (await api.post(url, body, cfg)).data;
api.putJson = async (url, body, cfg = {}) => (await api.put(url, body, cfg)).data;
api.patchJson = async (url, body, cfg = {}) => (await api.patch(url, body, cfg)).data;

/* ------------------------ Retry helper for GET (exponential) ------------ */
/**
 * getWithRetry(url, cfg = {}, opts = { attempts: 3, baseDelay: 300 })
 * - retries on network errors and 5xx responses
 * - does NOT retry 4xx other than 429 (you may choose to handle 429)
 */
api.getWithRetry = async function (url, cfg = {}, opts = {}) {
  const attempts = Number(opts.attempts || 3);
  const baseDelay = Number(opts.baseDelay || 300); // ms
  let attempt = 0;

  while (true) {
    try {
      const res = await api.get(url, cfg);
      return res.data;
    } catch (err) {
      attempt++;
      const status = err?.response?.status;
      const isNetworkError = !err?.response;
      const isServerError = status >= 500 && status < 600;
      const isRateLimit = status === 429;

      // Decide whether to retry
      const shouldRetry = (isNetworkError || isServerError || isRateLimit) && attempt < attempts;
      if (!shouldRetry) throw err;

      // Exponential backoff with jitter
      const jitter = Math.floor(Math.random() * 100);
      const delay = Math.min(5000, baseDelay * Math.pow(2, attempt - 1) + jitter);
      if (API_DEBUG) console.warn(`[api] retrying GET ${url} attempt=${attempt} delay=${delay}ms`, err?.message || err);
      await new Promise((r) => setTimeout(r, delay));
    }
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
    api.setAuthToken(token);
    if (API_DEBUG) console.debug("[api] primeAuth set", { role: canonical, sameOrigin: SAME_ORIGIN, cookieAuth: COOKIE_AUTH });
  } catch (e) {
    console.error("[api] primeAuth failed:", e);
  }
}

/* ------------------------- Startup hydration (NEW + debug preview) ------------------------ */
(() => {
  try {
    const { token } = getAuthFromStorage();
    if (token) {
      api.setAuthToken(token);
      if (API_DEBUG) {
        try {
          console.debug("[api] startup hydration set token preview:", token?.slice?.(0, 40) + "...");
        } catch {}
      }
    }
  } catch {}
})();

/* ------------------------ Always-fresh GET convenience -------------------- */
api.getFresh = async (url, cfg = {}) => {
  const res = await api.get(url, {
    ...(cfg || {}),
    params: { ...(cfg.params || {}), _ts: Date.now() },
  });
  return res.data;
};

export default api;
export { canonRole, getAuthFromStorage, COOKIE_AUTH, API_DEBUG };
