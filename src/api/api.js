// frontend/src/api/api.js
// Production-ready Axios instance (URL normalizer, auth header, retries, safe theaters POST guard)

import axios from "axios";

/* Base URL */
const BASE_URL = (
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
).replace(/\/+$/, "");

/* Auth helpers */
function getAuthFromStorage() {
  try {
    const raw = localStorage.getItem("auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const token = parsed.token || parsed.accessToken || parsed.jwt;
        const role =
          parsed.role || (Array.isArray(parsed.roles) ? parsed.roles[0] : undefined);
        if (token) return { token, role };
      }
    }
  } catch {}
  const tokenStr = localStorage.getItem("token");
  if (tokenStr) return { token: tokenStr, role: undefined };
  return { token: null, role: undefined };
}

/* Axios instance */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

/* Request interceptor */
api.interceptors.request.use((config) => {
  if (typeof config.url === "string") {
    let u = config.url.replace(/^\/+/, "/");
    if (config.baseURL?.endsWith("/api")) {
      u = u.replace(/^\/api(\/|$)/i, "/");
    }
    if (!u.startsWith("/")) u = `/${u}`;
    config.url = u;
  }

  const { token, role } = getAuthFromStorage();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    if (role) config.headers["X-Role"] = role;
  }

  const method = (config.method || "GET").toUpperCase();
  const previewPath = typeof config.url === "string" ? config.url : "";
  const previewUrl = (config.baseURL || "") + (previewPath.startsWith("/") ? "" : "/") + previewPath;
  console.log(`[API] ${method} → ${previewUrl}`, config.params || "");

  const urlLower = (config.url || "").toLowerCase();
  const isRootTheatersPost = method === "POST" && /^\/?theaters(\?.*)?$/i.test(urlLower);
  const isTagged = config.headers?.["X-Intent"] === "create-theater";
  if (isRootTheatersPost && !isTagged) {
    console.warn("⚠️  Rogue POST /theaters detected (no X-Intent). Stack:");
    console.trace();
  }

  return config;
});

/* Response + retry */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error?.config || {};
    const method = (cfg.method || "").toUpperCase();
    const status = error?.response?.status;

    if (status === 401) {
      try { window.dispatchEvent(new CustomEvent("api:unauthorized", { detail: cfg?.url })); } catch {}
      return Promise.reject(error);
    }

    if (typeof status === "number" && status >= 400 && status < 500) {
      return Promise.reject(error);
    }

    const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(method);
    const isTimeout = error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
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

/* Warn only for api.post('theaters', ...) on root collection */
const __origPost = api.post.bind(api);
api.post = function patchedPost(url, ...rest) {
  const u = (url || "").toString().replace(/^\//, "");
  if (/^theaters(\?.*)?$/i.test(u)) {
    const cfg = rest[1] || rest[2] || {};
    const headers = (cfg && cfg.headers) || {};
    const tagged = headers["X-Intent"] === "create-theater";
    if (!tagged) {
      console.warn("⚠️ ROGUE api.post('theaters', ...) call detected. Stack:");
      console.trace();
    }
  }
  return __origPost(url, ...rest);
};

export async function wakeBackend() {
  try {
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" }).catch(() =>
      fetch(`${BASE_URL}/theaters?page=1&limit=1`, { cache: "no-store" })
    );
  } catch {}
}

export default api;
