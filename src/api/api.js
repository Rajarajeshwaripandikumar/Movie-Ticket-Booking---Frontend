// src/api/api.js
import axios from "axios";

/* ------------------------------ Env & Debug ------------------------------ */
const isProd = import.meta.env.PROD;
const envBase = (import.meta.env.VITE_API_BASE_URL || "").trim(); // e.g. https://movie-ticket-booking-backend-o1m2.onrender.com
const debug = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

/* --------------------------- Strict base URL rule ------------------------ */
// In production we REQUIRE VITE_API_BASE_URL. Fail fast if missing.
if (isProd && !envBase) {
  throw new Error("❌ VITE_API_BASE_URL is missing in production build!");
}

// In dev, default to local backend if not provided.
let baseURL = envBase || "http://localhost:8080";

// Normalize and ensure trailing /api
baseURL = baseURL.replace(/\/+$/, "");
if (!baseURL.endsWith("/api")) baseURL += "/api";

console.info(`[API] Base URL = ${baseURL} (mode=${isProd ? "prod" : "dev"})`);

/* ------------------------------ Axios setup ----------------------------- */
const api = axios.create({
  baseURL,                // e.g. https://...onrender.com/api
  withCredentials: false, // set true only if you use cookies
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

/* ---------------------- Interceptor: path + token ----------------------- */
api.interceptors.request.use(
  (config) => {
    try {
      const base = String(config.baseURL || api.defaults.baseURL || "");
      const baseEndsWithApi = base.replace(/\/+$/, "").endsWith("/api");
      if (typeof config.url === "string" && baseEndsWithApi && config.url.startsWith("/api/")) {
        config.url = config.url.replace(/^\/api/, "");
      }
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      if (debug) console.log("[api] →", config.method?.toUpperCase(), `${config.baseURL}${config.url}`);
    } catch (e) {
      if (debug) console.warn("[api] request interceptor error", e);
    }
    return config;
  },
  (err) => Promise.reject(err)
);

/* ---------------------- Interceptor: 401 handling ----------------------- */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
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

/* ----------------------------- Exports ---------------------------------- */
export const API_BASE_URL = baseURL.replace(/\/+$/, "");
export const getSSEUrl = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return `${API_BASE_URL.replace(/\/api$/, "")}/api/notifications/stream?token=${token}`;
};

export default api;
