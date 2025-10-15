// src/api/api.js
// Centralized Axios client with:
// - Env-based baseURL + optional API prefix
// - Safe URL join (no double slashes)
// - JSON defaults + auth header from localStorage
// - Request/response logging (like your console output)
// - Normalized error object
// - Longer timeout (60s) + single retry on timeout/temporary network issues

import axios from "axios";

/* --------------------------------- Config --------------------------------- */

// .env usage (Vite):
// VITE_API_BASE_URL=https://movie-ticket-booking-backend-o1m2.onrender.com
// VITE_API_PREFIX=/api            // or /api/v1   (leave blank to disable)
const MODE = import.meta.env.MODE;
const ENV_BASE = import.meta.env.VITE_API_BASE_URL?.trim();
const ENV_PREFIX = (import.meta.env.VITE_API_PREFIX ?? "/api").trim();

// Fallbacks if env is missing
const DEFAULT_BASE = "https://movie-ticket-booking-backend-o1m2.onrender.com";
const DEFAULT_PREFIX = "/api";

// Choose baseURL + prefix
const BASE_URL = (ENV_BASE || DEFAULT_BASE).replace(/\/+$/, "");
const API_PREFIX =
  ENV_PREFIX === "" ? "" : (ENV_PREFIX || DEFAULT_PREFIX).replace(/\/+$/, "");

// Little helper to join without double slashes
function joinUrl(base, path) {
  if (!path) return base;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

// For logs
function log(...args) {
  if (MODE !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  } else {
    // Keep lightweight logs in prod too (matches your screenshot)
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

// Show resolved base once
log("[API] Base URL =", joinUrl(BASE_URL, API_PREFIX) || BASE_URL, `(mode=${MODE})`);

/* ------------------------------ Axios instance ----------------------------- */

const api = axios.create({
  baseURL: joinUrl(BASE_URL, API_PREFIX), // <- DO NOT include /api in request paths if you set prefix here
  timeout: 60000, // 60s to survive cold starts on Render free tier
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ---------------------------- Auth header helper --------------------------- */

function getToken() {
  // Adjust if you store JWT under a different key
  return localStorage.getItem("token");
}

/* --------------------------- Request interceptor --------------------------- */

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Full, absolute URL for logging
    const url = joinUrl(config.baseURL || "", config.url || "");
    log("[api] →", (config.method || "GET").toUpperCase(), url);

    return config;
  },
  (error) => Promise.reject(error)
);

/* --------------------------- Response interceptor -------------------------- */

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || "";
    const status = error.response?.status;
    const data = error.response?.data;

    // Normalize one-line error like your logs:
    log("[api]  [api] response error", {
      status,
      url,
      data,
    });

    // Simple one-time retry on timeout / network for idempotent-ish calls
    const shouldRetry =
      (!error.response || error.code === "ECONNABORTED") &&
      !cfg.__retryCount &&
      ["GET", "POST", "PUT", "PATCH"].includes((cfg.method || "").toUpperCase());

    if (shouldRetry) {
      cfg.__retryCount = 1;
      // small backoff
      await new Promise((res) => setTimeout(res, 1500));
      return api.request(cfg);
    }

    // Optionally handle 401 (token expired) here
    // if (status === 401) { /* redirect to login / clear token */ }

    // Throw a clean, consistent error object
    const normalized = new AxiosFriendlyError(error);
    return Promise.reject(normalized);
  }
);

/* ------------------------------ Error wrapper ------------------------------ */

class AxiosFriendlyError extends Error {
  constructor(err) {
    const status = err?.response?.status;
    const message =
      err?.response?.data?.message ||
      err?.message ||
      "Request failed. Please try again.";

    super(message);
    this.name = "AxiosError";
    this.status = status;
    this.code = err?.code;
    this.data = err?.response?.data;
    this.url = err?.config?.url;
    this.method = err?.config?.method;
    this.original = err;
  }
}

/* --------------------------- Convenience helpers --------------------------- */

// These ensure you pass **endpoint paths without the prefix** when using API_PREFIX.
// Example: post("/auth/register", body)
const get = (url, config) => api.get(url, config);
const del = (url, config) => api.delete(url, config);
const post = (url, data, config) => api.post(url, data, config);
const put = (url, data, config) => api.put(url, data, config);
const patch = (url, data, config) => api.patch(url, data, config);

// Explicit auth calls (optional, for convenience)
const AuthAPI = {
  register: (payload) => post("/auth/register", payload),
  login: (payload) => post("/auth/login", payload),
  me: () => get("/auth/me"),
};

// Health check (useful in your app startup)
const HealthAPI = {
  ping: () => get("/health"),
};

export { api, get, post, put, patch, del, AuthAPI, HealthAPI };

/* --------------------------------- Notes ---------------------------------- */
/*
  IMPORTANT: Pick ONE of these patterns and stick with it.

  A) Prefix set in axios (recommended; this file does it):
     - api.baseURL = https://.../api  (or /api/v1)
     - Call endpoints WITHOUT prefix: post("/auth/register", body)

  B) No prefix in axios:
     - api.baseURL = https://...
     - Call endpoints WITH prefix: post("/api/auth/register", body) or "/api/v1/auth/register"

  Avoid double-prefixing like baseURL ends with /api and you also call post("/api/auth/...").
*/
