// frontend/src/api/api.js
import axios from "axios";

/* -------------------------------------------------------------------------- */
/*                                 BASE URL                                   */
/* -------------------------------------------------------------------------- */
// Correct fallback: 0 (zero) + l (ell)
const FALLBACK_BASE = "https://movie-ticket-booking-backend-0lm2.onrender.com";
export const BASE_URL = (import.meta.env.VITE_API_BASE || FALLBACK_BASE).replace(/\/+$/, "");
const API_PREFIX = "/api";
export const AXIOS_BASE = `${BASE_URL}${API_PREFIX}`.replace(/\/+$/, "");

// Loud warning if someone accidentally uses the wrong service (o1m2)
if (BASE_URL.includes("-o1m2.")) {
  console.warn(
    "[api] WARNING: BASE_URL seems to be 'o1m2' (letter-o + one). " +
      "If your backend is '0lm2' (zero + ell), update VITE_API_BASE immediately:",
    BASE_URL
  );
}

/* -------------------------------------------------------------------------- */
/*                            Role canonicalization                           */
/* -------------------------------------------------------------------------- */
function canonRole(r) {
  if (!r && r !== "") return "";
  const raw =
    typeof r === "object" && r !== null ? r.authority ?? r.value ?? r.name ?? "" : r;
  let v = String(raw).toUpperCase().trim().replace(/\s+/g, "_");
  if (v.startsWith("ROLE_")) v = v.slice(5);

  const map = {
    // super admin aliases
    ADMIN: "SUPER_ADMIN",
    SUPERADMIN: "SUPER_ADMIN",
    // theater admin aliases
    THEATRE_ADMIN: "THEATER_ADMIN",
    THEATRE_MANAGER: "THEATER_ADMIN",
    THEATER_MANAGER: "THEATER_ADMIN",
    PVR_MANAGER: "THEATER_ADMIN",
    PVR_ADMIN: "THEATER_ADMIN",
    MANAGER: "THEATER_ADMIN",
  };
  return map[v] ?? v;
}

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
  baseURL: AXIOS_BASE, // every request now goes to /api/*
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

      const normalizedRole = canonRole(role);
      if (normalizedRole && !config.headers["X-Role"]) {
        config.headers["X-Role"] = normalizedRole;
      }

      if (API_DEBUG) {
        console.debug(
          "[api] attaching auth header, tokenPresent=true, headerPreviewLen=",
          (token || "").length,
          "role=",
          normalizedRole
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
    api.defaults.headers.common = api.defaults.headers.common || {};
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
/*                         Convenience helpers (404→null)                     */
/* -------------------------------------------------------------------------- */
api.safeGet = async (url, cfg) => {
  try {
    const res = await api.get(url, cfg);
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
};

api.safeDelete = async (url, cfg) => {
  try {
    const res = await api.delete(url, cfg);
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
};

/* -------------------------------------------------------------------------- */
/*                          Error extraction helper                           */
/* -------------------------------------------------------------------------- */
export function extractApiError(err) {
  const server = err?.response?.data;
  return (
    (server && (server.message || server.error || server.details)) ||
    (server && typeof server === "string" ? server : null) ||
    `HTTP ${err?.response?.status ?? ""} ${err?.message ?? "Request failed"}`
  );
}

/* -------------------------------------------------------------------------- */
/*                             Helper utilities                               */
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
/*                                 Exports                                    */
/* -------------------------------------------------------------------------- */
export default api;
