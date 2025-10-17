// src/api/api.js
// Production-ready Axios instance for Render + debugging aids for /theaters 409 issue

import axios from "axios";

/* -------------------------------------------------------------------------- */
/* Base URL Setup                                                             */
/* -------------------------------------------------------------------------- */
const BASE_URL =
  (import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com/api")
    .replace(/\/+$/, ""); // trim trailing slashes

/* -------------------------------------------------------------------------- */
/* Axios Instance                                                             */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: BASE_URL, // e.g., https://.../api
  timeout: 60000,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

/* -------------------------------------------------------------------------- */
/* Request Interceptor                                                        */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("auth"); // { token, role, ... }
    if (raw) {
      const { token } = JSON.parse(raw) || {};
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch { /* noop */ }

  // Debug: print every request
  const method = (config.method || "GET").toUpperCase();
  const url = `${config.baseURL}${config.url?.startsWith("/") ? "" : "/"}${config.url}`;
  console.log(`[API] ${method} → ${url}`, config.params || "");

  // Rogue POST detector (interceptor-level)
  const isPost = method === "POST";
  const urlLower = (config.url || "").toLowerCase();
  const isTheaterPost = /(^|\/)theaters(?:$|\?)/.test(urlLower);
  const isTagged = config.headers?.["X-Intent"] === "create-theater";
  if (isPost && isTheaterPost && !isTagged) {
    console.warn("⚠️  Rogue POST /theaters detected (no X-Intent). Stack:");
    console.trace();
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

    // Retry only idempotent requests on network/timeout
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
/* Monkey-patch only api.post('theaters', ...) to expose accidental callers   */
/* -------------------------------------------------------------------------- */
const __origPost = api.post.bind(api);
api.post = function patchedPost(url, ...rest) {
  const u = (url || "").toString().replace(/^\//, "");
  if (u.startsWith("theaters")) {
    const cfg = rest[1] || rest[2] || {};
    const headers = (cfg && cfg.headers) || {};
    const tagged = headers["X-Intent"] === "create-theater";
    if (!tagged) {
      console.warn("⚠️ ROGUE api.post('theaters', ...) call detected. Stack:");
      // eslint-disable-next-line no-console
      console.trace();
    }
  }
  return __origPost(url, ...rest);
};

/* -------------------------------------------------------------------------- */
/* Helper to wake backend                                                     */
/* -------------------------------------------------------------------------- */
export async function wakeBackend() {
  try {
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" }).catch(() =>
      fetch(`${BASE_URL}/theaters?page=1&limit=1`, { cache: "no-store" })
    );
  } catch {
    // ignore
  }
}

export default api;
