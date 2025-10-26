// frontend/src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                                 BASE URL                                   */
/* -------------------------------------------------------------------------- */
const BASE_URL = (import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com")
  .replace(/\/+$/, "");

/* -------------------------------------------------------------------------- */
/*                      Token retrieval + small cookie helper                 */
/* -------------------------------------------------------------------------- */
function readCookie(name) {
  try {
    const cookie = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
    if (!cookie) return null;
    return decodeURIComponent(cookie.split("=")[1]);
  } catch {
    return null;
  }
}

function getAuthFromStorage() {
  try {
    // 1) structured auth object
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

    // 2) flat keys
    const flatKeys = ["token", "jwt", "accessToken", "authToken"];
    for (const k of flatKeys) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return { token: v, role: undefined };
    }

    // 3) cookies (if your auth writes cookie)
    const cookieToken = readCookie("token") || readCookie("jwt") || readCookie("accessToken");
    if (cookieToken) return { token: cookieToken, role: undefined };
  } catch (e) {
    // ignore
  }
  return { token: null, role: undefined };
}

/* -------------------------------------------------------------------------- */
/*                              Axios instance                                 */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

/* -------------------------------------------------------------------------- */
/*            Ensure axios doesn't override FormData content-type             */
/* -------------------------------------------------------------------------- */
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((method) => {
    if (api.defaults.headers[method]) {
      delete api.defaults.headers[method]["Content-Type"];
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                         Request interceptor (JWT)                          */
/* -------------------------------------------------------------------------- */
// small debug toggle - set to true while testing
const API_DEBUG = false;

api.interceptors.request.use((config) => {
  try {
    const { token, role } = getAuthFromStorage();
    if (token) {
      config.headers = config.headers || {};
      // don't overwrite existing Authorization if set explicitly per-request
      if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
      if (role && !config.headers["X-Role"]) config.headers["X-Role"] = role;
      if (API_DEBUG) {
        // don't log actual token in production; only presence/length
        // eslint-disable-next-line no-console
        console.debug("[api] attaching auth header, tokenPresent=true, headerPreviewLen=", (token || "").length);
      }
    } else {
      if (API_DEBUG) {
        // eslint-disable-next-line no-console
        console.debug("[api] no token found, Authorization header not attached");
      }
    }
  } catch (e) {
    // ignore interceptor errors
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*                         Response interceptor (401 handler)                 */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                          Helper / programmatic setter                      */
/* -------------------------------------------------------------------------- */
let _manualToken = null;

/**
 * Optionally set token programmatically (useful immediately after login)
 * api.setAuthToken(token) will ensure subsequent requests include header
 */
api.setAuthToken = (token) => {
  _manualToken = token;
  if (token) {
    api.defaults.headers.common = api.defaults.headers.common || {};
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    if (api.defaults.headers.common) delete api.defaults.headers.common.Authorization;
  }
};

/* fallback: if manual token set, prefer it */
api.interceptors.request.use((config) => {
  if (_manualToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${_manualToken}`;
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*                             Helper utilities                                */
/* -------------------------------------------------------------------------- */
export function apiUrl(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

export function makeAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads") || url.includes("/uploads/")) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

/* -------------------------------------------------------------------------- */
/*                                 Exports                                     */
/* -------------------------------------------------------------------------- */
export default api;
