// src/api/api.js
// Production-ready Axios instance for Render + debugging aids for /theaters 409 issue

import axios from "axios";

/* -------------------------------------------------------------------------- */
/* Base URL Setup                                                             */
/* -------------------------------------------------------------------------- */
// Use env var if available, fallback to Render API
const BASE_URL =
  (import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com/api")
    .replace(/\/+$/, ""); // remove trailing slashes

/* -------------------------------------------------------------------------- */
/* Axios Instance                                                             */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: BASE_URL, // ✅ no trailing slash
  timeout: 60000,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

/* -------------------------------------------------------------------------- */
/* Request Interceptor                                                        */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use((config) => {
  try {
    // Attach JWT if stored in localStorage
    const raw = localStorage.getItem("auth"); // { token, role, ... }
    if (raw) {
      const { token } = JSON.parse(raw) || {};
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* noop */
  }

  // --- Debugging: Log every request (method + url) ---
  const method = (config.method || "GET").toUpperCase();
  const url = `${config.baseURL}${config.url?.startsWith("/") ? "" : "/"}${config.url}`;
  console.log(`[API] ${method} → ${url}`, config.params || "");

  // --- Rogue POST detector (for unwanted POST /api/theaters) ---
  const isPost = method === "POST";
  const urlLower = (config.url || "").toLowerCase();
  const isTheaterPost = /\/?theaters(?:\?|$)/.test(urlLower);
  const isTagged = config.headers?.["X-Intent"] === "create-theater";

  if (isPost && isTheaterPost && !isTagged) {
    console.warn("⚠️  Rogue POST /theaters detected — likely triggered by file picker or unintended code!");
    console.trace(); // shows where it originated in your React stack
  }

  return config;
});

/* -------------------------------------------------------------------------- */
/* Response Interceptor + Retry Logic                                         */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error?.config || {};
    const method = (cfg.method || "").toUpperCase();
    const status = error?.response?.status;

    // Don't retry client errors (4xx)
    if (typeof status === "number" && status >= 400 && status < 500) {
      return Promise.reject(error);
    }

    // Retry only idempotent requests
    const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(method);
    const isTimeout =
      error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
    const isNetwork = !error?.response;

    if (!isIdempotent) return Promise.reject(error);

    cfg.__retryCount = cfg.__retryCount || 0;
    if ((isTimeout || isNetwork) && cfg.__retryCount < 2) {
      cfg.__retryCount += 1;
      console.warn(`[API] Retrying ${method} ${cfg.url} (${cfg.__retryCount})`);
      await new Promise((r) => setTimeout(r, 1500 * cfg.__retryCount));
      return api(cfg);
    }

    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/* Helper to wake backend                                                     */
/* -------------------------------------------------------------------------- */
export async function wakeBackend() {
  try {
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" }).catch(() =>
      fetch(`${BASE_URL}/theaters?page=1&limit=1`, { cache: "no-store" })
    );
  } catch {
    // ignore — normal calls will proceed/retry as needed
  }
}

export default api;
