// frontend/src/api/analytics.js
import api, { apiUrl } from "./api";

/* -------------------------------------------------------------------------- */
/* Token helper: match api.js behaviour (adminToken preferred when present)   */
/* -------------------------------------------------------------------------- */
function getAuthToken() {
  try {
    const adminToken = localStorage.getItem("adminToken");
    const userToken = localStorage.getItem("token");

    if (adminToken) return adminToken;
    if (userToken) return userToken;

    // Legacy fallbacks (if you still have old keys)
    const rawAuth =
      localStorage.getItem("auth") || sessionStorage.getItem("auth");
    if (rawAuth) {
      const a = JSON.parse(rawAuth);
      if (a?.token) return a.token;
      if (a?.user?.token) return a.user.token;
    }

    return (
      localStorage.getItem("auth_token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("auth_token") ||
      sessionStorage.getItem("token") ||
      null
    );
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* HTTP endpoints (all use shared axios instance so JWT header is attached)   */
/* Pass ONLY paths without /api (api.js already prefixes /api).               */
/* Each function now takes (days, { params, signal } = {})                    */
/* -------------------------------------------------------------------------- */

export async function fetchRevenueTrends(days = 30, options = {}) {
  const { params = {}, signal } = options;

  const { data } = await api.get("/analytics/revenue/trends", {
    params: { ...params, days },
    signal,
  });

  // backend: [{ date, totalRevenue, bookings }]
  return data;
}

export async function fetchBookingSummary(days = 30, options = {}) {
  const { params = {}, signal } = options;

  const { data } = await api.get("/analytics/bookings/summary", {
    params: { ...params, days },
    signal,
  });

  // backend: [{ date, confirmed, cancelled, revenue }]
  return data;
}

export async function fetchPopularMovies(days = 30, limit = 10, options = {}) {
  const { params = {}, signal } = options;

  const { data } = await api.get("/analytics/movies/popular", {
    params: { ...params, days, limit },
    signal,
  });

  // backend: [{ movieId, movieName, totalBookings, totalRevenue }]
  return data;
}

export async function fetchActiveUsers(days = 30, options = {}) {
  const { params = {}, signal } = options;

  const { data } = await api.get("/analytics/users/active", {
    params: { ...params, days },
    signal,
  });

  // backend: [{ date, dau }]
  return data;
}

export async function fetchOccupancy(days = 30, options = {}) {
  const { params = {}, signal } = options;

  const { data } = await api.get("/analytics/occupancy", {
    params: { ...params, days },
    signal,
  });

  // backend: [{ theaterName, occupancyRate }]
  return data;
}

/* -------------------------------------------------------------------------- */
/* SSE stream (EventSource cannot set headers; we pass ?token=)               */
/* Backend middleware promotes ?token to Authorization header.                */
/* -------------------------------------------------------------------------- */
export function openAnalyticsStream(extraParams = {}) {
  const token = getAuthToken();
  const url = new URL(apiUrl("/analytics/stream"));

  if (token) url.searchParams.set("token", token);

  for (const [k, v] of Object.entries(extraParams || {})) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  return new EventSource(url.toString());
}
