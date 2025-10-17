// src/api/api.js  (or api.ts)
// Production-ready Axios instance for Render

import axios from "axios";

const BASE_URL = "https://movie-ticket-booking-backend-o1m2.onrender.com/api"; // <-- include /api

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // render cold starts
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from your storage/AuthContext (adjust if you store differently)
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("auth"); // { token, role, ... }
    if (raw) {
      const { token } = JSON.parse(raw) || {};
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch { /* noop */ }
  return config;
});

// Retry only idempotent requests; never retry 4xx/409; never retry writes
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error?.config || {};
    const method = (cfg.method || "").toUpperCase();
    const status = error?.response?.status;

    // If server responded with 4xx (e.g., 400, 401, 403, 404, 409), don't retry
    if (typeof status === "number" && status >= 400 && status < 500) {
      return Promise.reject(error);
    }

    // Only retry GET/HEAD/OPTIONS on network/timeout
    const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(method);
    const isTimeout = error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
    const isNetwork = !error?.response; // no HTTP response at all

    if (!isIdempotent) return Promise.reject(error);

    cfg.__retryCount = cfg.__retryCount || 0;
    if ((isTimeout || isNetwork) && cfg.__retryCount < 2) {
      cfg.__retryCount += 1;
      await new Promise((r) => setTimeout(r, 1500 * cfg.__retryCount));
      return api(cfg);
    }

    return Promise.reject(error);
  }
);

export default api;

// Optional: wake backend before first auth action
export async function wakeBackend() {
  try {
    // Try a very cheap GET to a public endpoint (health or theaters)
    // Using fetch so it bypasses Axios interceptors/retries
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" })
      .catch(() => fetch(`${BASE_URL}/theaters?page=1&limit=1`, { cache: "no-store" }));
  } catch {
    // ignore — normal calls will proceed/retry as needed
  }
}
