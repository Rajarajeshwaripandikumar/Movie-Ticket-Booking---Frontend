// frontend/src/api/api.js
import axios from "axios";

const BASE_URL = (
  import.meta.env.VITE_API_BASE ||
  "https://movie-ticket-booking-backend-o1m2.onrender.com/api"
).replace(/\/+$/, "");

/* Extract auth token and role safely */
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
        (Array.isArray(parsed?.roles) ? parsed?.roles[0] : undefined);
      if (token) return { token, role };
    }
  } catch {}
  const flat = localStorage.getItem("token") || localStorage.getItem("jwt");
  if (flat) return { token: flat, role: undefined };
  return { token: null, role: undefined };
}

/* Axios instance */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  withCredentials: false,
  // DO NOT set Content-Type here — let the browser/axios decide per-request.
  headers: { Accept: "application/json" },
});

// Ensure we don't accidentally force JSON for FormData uploads
if (api.defaults && api.defaults.headers) {
  if (api.defaults.headers.post) delete api.defaults.headers.post["Content-Type"];
  if (api.defaults.headers.put) delete api.defaults.headers.put["Content-Type"];
  if (api.defaults.headers.patch) delete api.defaults.headers.patch["Content-Type"];
}

/* Request interceptor: attach token */
api.interceptors.request.use((config) => {
  const { token, role } = getAuthFromStorage();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    if (role) config.headers["X-Role"] = role;
  } else {
    // keep this warning if you want, but it's noisy in production
    console.warn("[API] Missing JWT —", config.url);
  }
  return config;
});

/* Response handling */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
      console.warn("[API] 401 Unauthorized:", error.config?.url);
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default api;
