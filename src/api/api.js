// src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                              Environment / Debug                           */
/* -------------------------------------------------------------------------- */

const envBase = import.meta.env.VITE_API_BASE_URL; // e.g. "http://localhost:8080"
const debug = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

/* -------------------------------------------------------------------------- */
/*                            Base URL Normalization                          */
/* -------------------------------------------------------------------------- */

let baseURL = String(envBase ?? "").trim().replace(/\/+$/, "");

if (!baseURL) {
  baseURL = "/api";
} else if (!baseURL.endsWith("/api")) {
  baseURL = `${baseURL}/api`;
}

if (debug) console.log("[API] Base URL =", baseURL);

/* -------------------------------------------------------------------------- */
/*                             Axios Instance Setup                           */
/* -------------------------------------------------------------------------- */

const api = axios.create({
  baseURL, // e.g. http://localhost:8080/api
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

/* -------------------------------------------------------------------------- */
/*                   Interceptor: Normalize + Inject Token                    */
/* -------------------------------------------------------------------------- */

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
/*                      Interceptor: Handle 401 + Logging                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                         Export Helper Constants                            */
/* -------------------------------------------------------------------------- */

/**
 * Export a clean API base URL (no trailing slash)
 * e.g. "http://localhost:8080/api"
 */
export const API_BASE_URL = baseURL.replace(/\/+$/, "");

/**
 * Utility: build SSE stream URL for current user
 * Returns e.g. "http://localhost:8080/api/notifications/stream?token=<jwt>"
 */
export const getSSEUrl = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return `${API_BASE_URL.replace(/\/api$/, "")}/api/notifications/stream?token=${token}`;
};

/* -------------------------------------------------------------------------- */
/*                                Export Default                              */
/* -------------------------------------------------------------------------- */

export default api;
