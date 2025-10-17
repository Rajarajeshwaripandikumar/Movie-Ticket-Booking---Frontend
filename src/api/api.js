// src/api/api.js
// Production-ready Axios instance for Render + debugging aids for /theaters 409 issue

import axios from "axios";

/* -------------------------------------------------------------------------- */
/* Base URL Setup                                                             */
/* -------------------------------------------------------------------------- */
const BASE_URL = (
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
).replace(/\/+$/, ""); // trim trailing slashes

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function getAuthFromStorage() {
  // Try structured auth object first
  try {
    const raw = localStorage.getItem("auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const token = parsed.token || parsed.accessToken || parsed.jwt;
        const role =
          parsed.role ||
          (Array.isArray(parsed.roles) ? parsed.roles[0] : undefined);
        if (token) return { token, role };
      }
    }
  } catch {
    /* noop */
  }
  // Fallback: plain token string
  const tokenStr = localStorage.getItem("token");
  if (tokenStr) return { token: tokenStr, role: undefined };
  return { token: null, role: undefined };
}

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
  // ---- URL NORMALIZER ------------------------------------------------------
  if (typeof config.url === "string") {
    let u = config.url;

    // Remove any accidental double leading slashes on the path (keep protocol in baseURL intact)
    u = u.replace(/^\/+/, "/");

    // If baseURL already includes /api, drop a leading /api from the path
    if (config.baseURL?.endsWith("/api")) {
      u = u.replace(/^\/api(\/|$)/i, "/");
    }

    // Ensure single leading slash so axios joins correctly
    if (!u.startsWith("/")) u = `/${u}`;

    config.url = u;
  }

  // ---- AUTH HEADER ---------------------------------------------------------
  const { token, role } = getAuthFromStorage();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    // Optional: send role if your backend wants it for debugging/metrics
    if (role) config.headers["X-Role"] = role;
  }

  // ---- DEBUG LOG -----------------------------------------------------------
  const method = (config.method || "GET").toUpperCase();
  const previewPath = typeof config.url === "string" ? config.url : "";
  const previewUrl =
    (config.baseURL || "") + (previewPath.startsWith("/") ? "" : "/") + previewPath;
  console.log(`[API] ${method} → ${previewUrl}`, config.params || "");

  // Rogue POST detector (interceptor-level)
  const urlLower = (config.url || "").toLowerCase();
  // ✅ Only flag POSTs to the **root** theaters collection (not nested routes like /:id/screens)
  const isRootTheatersPost =
    method === "POST" && /^\/?theaters(\?.*)?$/i.test(urlLower);
  const isTagged = config.headers?.["X-Intent"] === "create-theater";
  if (isRootTheatersPost && !isTagged) {
    console.warn("⚠️  Rogue POST /theaters detected (no X-Intent). Stack:");
    // eslint-disable-next-line no-console
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

    // 🔒 Handle 401s explicitly (optional auto-logout hook)
    if (status === 401) {
      try {
        window.dispatchEvent(new CustomEvent("api:unauthorized", { detail: cfg?.url }));
      } catch {}
      return Promise.reject(error);
    }

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
  // ✅ Only warn when posting to the root collection "theaters" (allow nested /:id/screens)
  if (/^theaters(\?.*)?$/i.test(u)) {
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
    // Try /api/health first; fall back to a cheap list call.
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" }).catch(
      () => fetch(`${BASE_URL}/theaters?page=1&limit=1`, { cache: "no-store" })
    );
  } catch {
    // ignore
  }
}

export default api;
