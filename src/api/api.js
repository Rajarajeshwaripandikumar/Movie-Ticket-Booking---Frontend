// frontend/src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                                 BASE URL                                   */
/* -------------------------------------------------------------------------- */
const BASE_URL = (import.meta.env.VITE_API_BASE || "https://movie-ticket-booking-backend-o1m2.onrender.com")
  .replace(/\/+$/, "");
const API_PREFIX = "/api";
const AXIOS_BASE = `${BASE_URL}${API_PREFIX}`.replace(/\/+$/, "");

/* -------------------------------------------------------------------------- */
/*                      Token retrieval + small cookie helper                 */
/* -------------------------------------------------------------------------- */
function readCookie(name) {
  try {
    const cookie = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + "="));
    if (!cookie) return null;
    return decodeURIComponent(cookie.split("=")[1]);
  } catch {
    return null;
  }
}

function getAuthFromStorage() {
  try {
    // 1) structured auth object
    const raw = localStorage.getItem("auth") || sessionStorage.getItem("auth");
    if (raw) {
      try {
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
      } catch {}
    }

    // 2) flat keys
    const flatKeys = ["token", "jwt", "accessToken", "authToken"];
    for (const k of flatKeys) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return { token: v, role: undefined };
    }

    // 3) cookies
    const cookieToken =
      readCookie("token") || readCookie("jwt") || readCookie("accessToken");
    if (cookieToken) return { token: cookieToken, role: undefined };
  } catch {
    // ignore
  }
  return { token: null, role: undefined };
}

/* -------------------------------------------------------------------------- */
/*                              Axios instance                                */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: AXIOS_BASE, // <-- every request now goes to /api/*
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
const API_DEBUG = false;

api.interceptors.request.use((config) => {
  try {
    const { token, role } = getAuthFromStorage();
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization)
        config.headers.Authorization = `Bearer ${token}`;
      if (role && !config.headers["X-Role"]) config.headers["X-Role"] = role;
      if (API_DEBUG) {
        console.debug(
          "[api] attaching auth header, tokenPresent=true, headerPreviewLen=",
          (token || "").length
        );
      }
    } else if (API_DEBUG) {
      console.debug("[api] no token found, Authorization header not attached");
    }
  } catch {
    // ignore
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
/*                          Helper / programmatic setter                      */
/* -------------------------------------------------------------------------- */
let _manualToken = null;

api.setAuthToken = (token) => {
  _manualToken = token;
  if (token) {
    api.defaults.headers.common =
      api.defaults.headers.common || {};
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else if (api.defaults.headers.common) {
    delete api.defaults.headers.common.Authorization;
  }
};

api.interceptors.request.use((config) => {
  if (_manualToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization)
      config.headers.Authorization = `Bearer ${_manualToken}`;
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*                             Helper utilities                                */
/* -------------------------------------------------------------------------- */
export function apiUrl(path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${clean}`;
}

export function makeAbsoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads") || url.includes("/uploads/")) {
    return `${BASE_URL}${url}`; // uploads live outside /api
  }
  return url;
}

/* -------------------------------------------------------------------------- */
/*                                 Exports                                     */
/* -------------------------------------------------------------------------- */
export default api;
