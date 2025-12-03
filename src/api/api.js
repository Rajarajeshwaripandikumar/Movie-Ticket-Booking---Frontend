// src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                              Environment / Debug                           */
/* -------------------------------------------------------------------------- */

const envBase = import.meta.env.VITE_API_BASE_URL; // e.g. "http://localhost:8080"
const debug = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

export const API_DEBUG = debug;

/* ---------------- feature flag: cookie-based auth ----------------------- */
export const COOKIE_AUTH =
  String(import.meta.env?.VITE_COOKIE_AUTH || "false").toLowerCase() ===
  "true";

/* -------------------------------------------------------------------------- */
/*                            Base URL Normalization                          */
/* -------------------------------------------------------------------------- */

let baseURL = String(envBase ?? "").trim().replace(/\/+$/, "");

// If no env base, assume frontend dev proxy: "/api"
if (!baseURL) {
  baseURL = "/api";
} else if (!baseURL.endsWith("/api")) {
  // Ensure trailing /api
  baseURL = `${baseURL}/api`;
}

if (debug) console.log("[API] Base URL =", baseURL);

/* -------------------------------------------------------------------------- */
/*                             Axios Instance Setup                           */
/* -------------------------------------------------------------------------- */

const api = axios.create({
  baseURL, // e.g. "http://localhost:8080/api" or "/api"
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Convenience alias used by some pages
api.getFresh = (url, config = {}) => api.get(url, config);

/* -------------------------------------------------------------------------- */
/*                      Auth helpers (token handling)                         */
/* -------------------------------------------------------------------------- */

let currentAuthToken = null;

function applyAuthToken(token) {
  currentAuthToken = token || null;
  if (token) {
    if (api.defaults && api.defaults.headers && api.defaults.headers.common) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  } else if (api.defaults && api.defaults.headers && api.defaults.headers.common) {
    delete api.defaults.headers.common.Authorization;
  }
}

/**
 * Allow callers (AuthContext) to set/reset token globally
 */
api.setAuthToken = (token) => {
  applyAuthToken(token);
};

/**
 * Helper used by AuthContext.login / loginAdmin to seed localStorage + axios
 */
export function primeAuth(token, role) {
  try {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    if (role) {
      localStorage.setItem("role", String(role));
    }
  } catch {
    // ignore
  }
  applyAuthToken(token);
}

/**
 * Helper to read token / role / user from localStorage if needed
 */
export function getAuthFromStorage() {
  try {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const rawUser = localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token, role, user };
  } catch {
    return { token: null, role: null, user: null };
  }
}

/**
 * Normalize Axios/API errors into a human-readable message
 */
export function extractApiError(err, fallback = "Something went wrong") {
  if (!err) return fallback;

  const data = err?.response?.data;
  if (typeof data === "string") return data;

  const msg =
    data?.message ||
    data?.error ||
    data?.details ||
    err?.message ||
    err?.toString?.();

  return msg || fallback;
}

/* -------------------------------------------------------------------------- */
/*                      Interceptor: Normalize + Inject Token                 */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use(
  (config) => {
    try {
      const base = String(config.baseURL || api.defaults.baseURL || "");
      const baseEndsWithApi = base.replace(/\/+$/, "").endsWith("/api");

      // Avoid double /api/api when caller uses "/api/..." paths
      if (
        typeof config.url === "string" &&
        baseEndsWithApi &&
        config.url.startsWith("/api/")
      ) {
        config.url = config.url.replace(/^\/api/, "");
      }

      // Inject JWT from localStorage if present (fallback to currentAuthToken)
      // Prefer adminToken if present (admin login) else user token
      let tokenToUse = currentAuthToken;
      let usingAdminToken = false;

      try {
        const userToken = localStorage.getItem("token");
        const adminToken = localStorage.getItem("adminToken");

        if (adminToken) {
          tokenToUse = adminToken;
          usingAdminToken = true;
        } else if (userToken) {
          tokenToUse = userToken;
        }
      } catch {
        // ignore storage errors
      }

      if (tokenToUse) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${tokenToUse}`;
        }
      }

      if (debug) {
        const full = `${config.baseURL || ""}${config.url || ""}`;
        console.log("[api] →", config.method?.toUpperCase(), full, {
          params: config.params,
          usingAdminToken,
        });
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
    // Swallow/quietly handle cancellations
    if (err?.code === "ERR_CANCELED" || axios.isCancel(err)) {
      if (debug) {
        console.warn("[api] request canceled", {
          url: err?.config?.url,
          message: err?.message,
        });
      }
      return Promise.reject(err);
    }

    const status = err?.response?.status;

    if (status === 401) {
      // Clear stored auth on unauthorized
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        localStorage.removeItem("adminToken");
      } catch {
        // ignore
      }
      applyAuthToken(null);

      if (debug) console.warn("[api] 401 — cleared stored token");

      // 🔔 Notify AuthContext listener
      try {
        window.dispatchEvent(new Event("api:unauthorized"));
      } catch {
        // ignore
      }
    }

    if (debug) {
      console.error("[api] response error", {
        status,
        url: err?.config?.url,
        data: err?.response?.data,
        code: err?.code, // extra visibility for network/CORS errors
        message: err?.message,
      });
    }

    return Promise.reject(err);
  }
);

/* -------------------------------------------------------------------------- */
/*                         Safe helper methods (data only)                    */
/* -------------------------------------------------------------------------- */

/**
 * safeGet: unwraps `data` and swallows most errors.
 * - On success: returns `response.data`
 * - On cancel: rethrows (so AbortError can be handled by caller if needed)
 * - On other errors: returns `fallback` (default `null`)
 */
api.safeGet = async (url, config = {}, fallback = null) => {
  try {
    const res = await api.get(url, config);
    return res.data;
  } catch (err) {
    if (err?.code === "ERR_CANCELED" || axios.isCancel(err)) {
      // let caller decide what to do with cancellation
      throw err;
    }
    if (debug) {
      console.warn("[api.safeGet] error", {
        url,
        code: err?.code,
        status: err?.response?.status,
        message: err?.message,
      });
    }
    return fallback;
  }
};

// Helpers if you ever want them later:
api.safePost = async (url, body, config = {}, fallback = null) => {
  try {
    const res = await api.post(url, body, config);
    return res.data;
  } catch (err) {
    if (err?.code === "ERR_CANCELED" || axios.isCancel(err)) {
      throw err;
    }
    if (debug) {
      console.warn("[api.safePost] error", {
        url,
        code: err?.code,
        status: err?.response?.status,
        message: err?.message,
      });
    }
    return fallback;
  }
};

api.safeDelete = async (url, config = {}, fallback = null) => {
  try {
    const res = await api.delete(url, config);
    return res.data;
  } catch (err) {
    if (err?.code === "ERR_CANCELED" || axios.isCancel(err)) {
      throw err;
    }
    if (debug) {
      console.warn("[api.safeDelete] error", {
        url,
        code: err?.code,
        status: err?.response?.status,
        message: err?.message,
      });
    }
    return fallback;
  }
};

/* -------------------------------------------------------------------------- */
/*                         Export Helper Constants                            */
/* -------------------------------------------------------------------------- */

/**
 * Export a clean API base URL (no trailing slash)
 * e.g. "http://localhost:8080/api" or "/api"
 */
export const API_BASE_URL = baseURL.replace(/\/+$/, "");

/**
 * Convenience: base origin without `/api` suffix
 * e.g. "http://localhost:8080"
 */
export const BASE_URL = API_BASE_URL.replace(/\/api$/, "");

/**
 * Small helper to build URLs off the API base
 *   apiUrl("/notifications/stream") -> "http://localhost:8080/api/notifications/stream"
 */
export const apiUrl = (path = "") => {
  const p = String(path || "");
  if (!p) return API_BASE_URL;
  return `${API_BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
};

/**
 * Convert a possibly-relative image URL into an absolute one
 * e.g. '/uploads/foo.jpg' -> 'http://localhost:8080/uploads/foo.jpg'
 */
export const makeAbsoluteImageUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url; // already absolute
  if (url.startsWith("/")) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
};

/**
 * Utility: build SSE stream URL for current user
 * Returns e.g. "http://localhost:8080/api/notifications/stream?token=<jwt>"
 */
export const getSSEUrl = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const root = API_BASE_URL.replace(/\/api$/, "");
  return `${root}/api/notifications/stream?token=${token}`;
};

/* -------------------------------------------------------------------------- */
/*                               Auth API                                     */
/* -------------------------------------------------------------------------- */

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  register: (payload) => api.post("/auth/register", payload),
  forgotPassword: (payload) => api.post("/auth/forgot", payload),
  me: () => api.get("/auth/me"),
};

/* -------------------------------------------------------------------------- */
/*                               Movies API                                   */
/* -------------------------------------------------------------------------- */

export const moviesApi = {
  list: (params) => api.get("/movies", { params }),
  getById: (id) => api.get(`/movies/${id}`),

  // Admin-only on backend
  create: (data) => api.post("/movies", data),
  update: (id, data) => api.patch(`/movies/${id}`, data),
  remove: (id) => api.delete(`/movies/${id}`),
};

/* -------------------------------------------------------------------------- */
/*                              Showtimes API                                 */
/* -------------------------------------------------------------------------- */

export const showtimesApi = {
  list: (params) => api.get("/showtimes", { params }), // movieId, theaterId, screenId, city, date
  getById: (id) => api.get(`/showtimes/${id}`), // returns showtime + seats

  create: (data) => api.post("/showtimes", data),
  update: (id, data) => api.patch(`/showtimes/${id}`, data),
  remove: (id) => api.delete(`/showtimes/${id}`),

  listMyTheatre: () => api.get("/showtimes/my-theatre"),

  availability: (params) => api.get("/showtimes/availability", { params }),
  moviesByCityDate: (params) => api.get("/showtimes/movies", { params }), // city, date
  cities: () => api.get("/showtimes/cities"),
};

/* -------------------------------------------------------------------------- */
/*                               Theaters API                                 */
/* -------------------------------------------------------------------------- */

export const theatersApi = {
  list: (params) => api.get("/theaters", { params }), // q, city, page, limit
  getById: (id) => api.get(`/theaters/${id}`),

  getScreensForTheater: (theaterId) =>
    api.get(`/theaters/${theaterId}/screens`),

  getMe: () => api.get("/theaters/me"),
  getMyScreens: () => api.get("/theaters/me/screens"),
  getMySummary: () => api.get("/theaters/me/summary"),

  adminCreate: (data) => api.post("/theaters/admin", data),
  adminUpdate: (id, data) => api.put(`/theaters/admin/${id}`, data),
  adminPatchAmenities: (id, data) =>
    api.patch(`/theaters/admin/${id}/amenities`, data),
  adminDelete: (id) => api.delete(`/theaters/admin/${id}`),
};

/* -------------------------------------------------------------------------- */
/*                                Screens API                                 */
/* -------------------------------------------------------------------------- */

export const screensApi = {
  getById: (screenId) => api.get(`/screens/${screenId}`),

  adminList: (params) => api.get("/screens/admin", { params }),
  adminCreate: (data) => api.post("/screens/admin", data),
  adminUpdate: (id, data) => api.put(`/screens/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/screens/admin/${id}`),
};

/* -------------------------------------------------------------------------- */
/*                                Pricing API                                 */
/* -------------------------------------------------------------------------- */

export const pricingApi = {
  list: (params) => api.get("/pricing", { params }),
  create: (data) => api.post("/pricing", data),
  bulkCreate: (data) => api.post("/pricing/bulk", data),
  remove: (id) => api.delete(`/pricing/${id}`),
  getMatrix: (params) => api.get("/pricing/matrix", { params }),
};

/* -------------------------------------------------------------------------- */
/*                               Bookings API                                 */
/* -------------------------------------------------------------------------- */

export const bookingsApi = {
  create: (data) => api.post("/bookings", data),
  listMine: (params) => api.get("/bookings/mine", { params }),
  getById: (id) => api.get(`/bookings/${id}`),
};

/* -------------------------------------------------------------------------- */
/*                                Tickets API                                 */
/* -------------------------------------------------------------------------- */

export const ticketsApi = {
  download: (bookingId) =>
    api.get(`/tickets/${bookingId}/download`, {
      responseType: "blob",
    }),
};

/* -------------------------------------------------------------------------- */
/*                                Orders API                                  */
/* -------------------------------------------------------------------------- */

export const ordersApi = {
  create: (data, idempotencyKey) =>
    api.post("/orders", data, {
      headers: idempotencyKey
        ? { "X-Idempotency-Key": idempotencyKey }
        : undefined,
    }),

  listMine: (params) => api.get("/orders/me", { params }),
  listAdmin: (params) => api.get("/orders", { params }), // admin-only
};

/* -------------------------------------------------------------------------- */
/*                               Payments API                                 */
/* -------------------------------------------------------------------------- */

export const paymentsApi = {
  createOrder: (data) => api.post("/payments/create-order", data),
  verifyPayment: (data) => api.post("/payments/verify-payment", data),
  mockSuccess: (data) => api.post("/payments/mock-success", data), // dev only
};

/* -------------------------------------------------------------------------- */
/*                                Uploads API                                 */
/* -------------------------------------------------------------------------- */

export const uploadsApi = {
  uploadSingle: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  uploadMultiple: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    return api.post("/upload/multiple", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  remove: (idOrUrl) => api.delete(`/upload/${encodeURIComponent(idOrUrl)}`),

  mode: () => api.get("/upload/mode"),
  ping: () => api.get("/upload/ping"),
};

/* -------------------------------------------------------------------------- */
/*                             Notifications API                              */
/* -------------------------------------------------------------------------- */

export const notificationsApi = {
  listMine: (params) => api.get("/notifications/mine", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

/* -------------------------------------------------------------------------- */
/*                         Notification Prefs API                             */
/* -------------------------------------------------------------------------- */

export const notificationPrefsApi = {
  getMe: () => api.get("/notification-prefs/me"),
  updateMe: (data) => api.patch("/notification-prefs/me", data),
};

/* -------------------------------------------------------------------------- */
/*                                Profile API                                 */
/* -------------------------------------------------------------------------- */

export const profileApi = {
  getProfile: () => api.get("/profile"),
  updateProfile: (data) => api.put("/profile", data),
  createBooking: (data) => api.post("/profile/bookings", data),
  listBookings: (params) => api.get("/profile/bookings", { params }),
  changePassword: (data) => api.post("/profile/change-password", data),
};

/* -------------------------------------------------------------------------- */
/*                                 Admin API                                  */
/* -------------------------------------------------------------------------- */

export const adminApi = {
  getTheaters: (params) => api.get("/admin/theaters", { params }),
  getDashboardSummary: (params) => api.get("/admin/summary", { params }),
  getDashboardStats: (params) => api.get("/admin/stats", { params }),
};

/* -------------------------------------------------------------------------- */
/*                              Super Admin API                               */
/* -------------------------------------------------------------------------- */

export const superAdminApi = {
  listTheaters: (params) => api.get("/superadmin/theaters", { params }),
  createTheater: (data) => api.post("/superadmin/theaters", data),
  updateTheater: (id, data) => api.put(`/superadmin/theaters/${id}`, data),
  deleteTheater: (id) => api.delete(`/superadmin/theaters/${id}`),

  listTheatreAdmins: (params) =>
    api.get("/superadmin/theatre-admins", { params }),
  createTheatreAdmin: (data) =>
    api.post("/superadmin/theatre-admins", data),
  updateTheatreAdmin: (id, data) =>
    api.put(`/superadmin/theatre-admins/${id}`, data),
  deleteTheatreAdmin: (id) =>
    api.delete(`/superadmin/theatre-admins/${id}`),
};

/* -------------------------------------------------------------------------- */
/*                               Analytics API                                */
/* -------------------------------------------------------------------------- */

export const analyticsApi = {
  getOverview: (params) => api.get("/analytics/overview", { params }),
  getTheatreAnalytics: (params) => api.get("/analytics/theatre", { params }),
  getMovieAnalytics: (params) => api.get("/analytics/movies", { params }),
  getRevenueAnalytics: (params) => api.get("/analytics/revenue", { params }),
};

/* -------------------------------------------------------------------------- */
/*                                Export Default                              */
/* -------------------------------------------------------------------------- */

export default api;
