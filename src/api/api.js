// src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                          🌍 Environment & Debug Setup                      */
/* -------------------------------------------------------------------------- */

const isProd = import.meta.env.PROD;
const envBase = (import.meta.env.VITE_API_BASE_URL || "").trim(); // e.g. https://movie-ticket-booking-backend-o1m2.onrender.com
const debug = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

/* -------------------------------------------------------------------------- */
/*                           🧩 Base URL Validation                            */
/* -------------------------------------------------------------------------- */

// In production, we must have VITE_API_BASE_URL defined
if (isProd && !envBase) {
  throw new Error("❌ VITE_API_BASE_URL is missing in production build!");
}

// In local development, fallback to localhost
let baseURL = envBase || "http://localhost:8080";

// Normalize: remove trailing slash, append '/api' if missing
baseURL = baseURL.replace(/\/+$/, "");
if (!baseURL.endsWith("/api")) baseURL += "/api";

// Always log base URL once for visibility
console.info(`[API] Base URL = ${baseURL} (mode=${isProd ? "prod" : "dev"})`);

/* -------------------------------------------------------------------------- */
/*                            ⚙️ Axios Configuration                           */
/* -------------------------------------------------------------------------- */

const api = axios.create({
  baseURL, // Example: https://movie-ticket-booking-backend-o1m2.onrender.com/api
  withCredentials: false, // change to true if you use cookies
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

/* -------------------------------------------------------------------------- */
/*                      🔐 Request Interceptor (JWT Token)                    */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use(
  (config) => {
    try {
      // Normalize duplicated /api/api/... URLs
      const base = String(config.baseURL || api.defaults.baseURL || "");
      const baseEndsWithApi = base.replace(/\/+$/, "").endsWith("/api");
      if (typeof config.url === "string" && baseEndsWithApi && config.url.startsWith("/api/")) {
        config.url = config.url.replace(/^\/api/, "");
      }

      // Inject token from localStorage if available
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      if (debug) {
        const full = `${config.baseURL}${config.url}`;
        console.log("[api] →", config.method?.toUpperCase(), full);
      }
    } catch (err) {
      if (debug) console.warn("[api] request interceptor error", err);
    }
    return config;
  },
  (err) => Promise.reject(err)
);

/* -------------------------------------------------------------------------- */
/*                    ⚠️ Response Interceptor (401 Handling)                  */
/* -------------------------------------------------------------------------- */

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      // Token expired or invalid → clear it
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (debug) console.warn("[api] 401 — cleared stored token");
    }

    if (debug) {
      console.error("[api] response error", {
        status,
        url: err?.config?.url,
        data: err?.response?.data,
      });
    }

    return Promise.reject(err);
  }
);

/* -------------------------------------------------------------------------- */
/*                        🔧 Utility: Export Constants                        */
/* -------------------------------------------------------------------------- */

/**
 * Clean API base URL (no trailing slash)
 * e.g. "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
 */
export const API_BASE_URL = baseURL.replace(/\/+$/, "");

/**
 * Build Server-Sent Event (SSE) stream URL for the logged-in user
 * e.g. "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream?token=<jwt>"
 */
export const getSSEUrl = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return `${API_BASE_URL.replace(/\/api$/, "")}/api/notifications/stream?token=${token}`;
};

/* -------------------------------------------------------------------------- */
/*                               🚀 Export Default                            */
/* -------------------------------------------------------------------------- */

export default api;
