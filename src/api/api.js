// frontend/src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                                 BASE URL                                   */
/* -------------------------------------------------------------------------- */
/**
 * Point to backend root (no trailing slash).
 * The frontend will call endpoints with the `/api` prefix, e.g. api.get("/api/theaters")
 */
const BASE_URL = (import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com").replace(/\/+$/, "");

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
/*                              Axios instance                                 */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: false,
  headers: { Accept: "application/json" },
});

/* -------------------------------------------------------------------------- */
/*            Ensure axios doesn't override FormData content-type             */
/* -------------------------------------------------------------------------- */
if (api.defaults && api.defaults.headers) {
  ["post", "put", "patch"].forEach((method) => {
    if (api.defaults.headers[method]) {
      delete api.defaults.headers[method]["Content-Type"];
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                         Request interceptor (JWT)                          */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use((config) => {
  const { token, role } = getAuthFromStorage();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    if (role) config.headers["X-Role"] = role;
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*                         Response interceptor (401 handler)                 */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                             Helper utilities                                */
/* -------------------------------------------------------------------------- */
export function apiUrl(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

export function makeAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // if DB contains /uploads/... convert to absolute URL
  if (url.startsWith("/uploads") || url.includes("/uploads/")) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

/* -------------------------------------------------------------------------- */
/*                                 Exports                                     */
/* -------------------------------------------------------------------------- */
export default api;
