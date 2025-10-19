// frontend/src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                             ✅ BASE URL SETUP                              */
/* -------------------------------------------------------------------------- */
/**
 * Your backend already exposes all routes under `/api`.
 * So we point BASE_URL directly to the backend root (without /api),
 * and include /api only in the request paths.
 *
 * Example:
 *   api.get("/api/theaters") -> https://movie-ticket-booking-backend-o1m2.onrender.com/api/theaters
 */
const BASE_URL = (
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com"
).replace(/\/+$/, "");

/* -------------------------------------------------------------------------- */
/*                    Extract auth token + role from storage                  */
/* -------------------------------------------------------------------------- */
function getAuthFromStorage() {
  try {
    const raw = localStorage.getItem("auth");
    if (raw) {
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
    }
  } catch {}
  const flat = localStorage.getItem("token") || localStorage.getItem("jwt");
  if (flat) return { token: flat, role: undefined };
  return { token: null, role: undefined };
}

/* -------------------------------------------------------------------------- */
/*                          Axios instance creation                           */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: false, // true only if backend uses cookies/sessions
  headers: { Accept: "application/json" },
});

/* -------------------------------------------------------------------------- */
/*                     Fix FormData content-type behavior                     */
/* -------------------------------------------------------------------------- */
// Ensure axios does NOT force JSON when sending FormData
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((method) => {
    if (api.defaults.headers[method]) {
      delete api.defaults.headers[method]["Content-Type"];
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                      Request interceptor: attach JWT                       */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use((config) => {
  const { token, role } = getAuthFromStorage();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    if (role) config.headers["X-Role"] = role;
  } else {
    console.warn("[API] Missing JWT →", config.url);
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*                        Response interceptor: 401 hook                      */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      console.warn("[API] 401 Unauthorized:", error.config?.url);
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Convenience wrapper for building full backend URLs.
 * Useful for image sources or manual fetch calls.
 */
export function apiUrl(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

/**
 * Normalizes a possibly relative image URL from DB.
 * Converts `/uploads/...` → full backend URL.
 */
export function makeAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const root = BASE_URL.replace(/\/api$/, "");
  if (url.startsWith("/uploads") || url.includes("/uploads/")) {
    return `${root}${url}`;
  }
  return url;
}

/* -------------------------------------------------------------------------- */
/*                               Export default                               */
/* -------------------------------------------------------------------------- */
export default api;
