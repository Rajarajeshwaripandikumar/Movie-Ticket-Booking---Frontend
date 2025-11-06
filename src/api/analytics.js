// frontend/src/api/analytics.js
import api from "./api";

export async function fetchRevenueTrends(days = 30, params = {}) {
  const { data } = await api.get("/analytics/revenue/trends", { params: { days, ...params } });
  return data;
}

export async function fetchBookingSummary(days = 30, params = {}) {
  const { data } = await api.get("/analytics/bookings/summary", { params: { days, ...params } });
  return data;
}

export async function fetchPopularMovies(days = 30, limit = 10, params = {}) {
  const { data } = await api.get("/analytics/popular-movies", { params: { days, limit, ...params } });
  return data;
}

export async function fetchActiveUsers(days = 30, params = {}) {
  const { data } = await api.get("/analytics/active-users", { params: { days, ...params } });
  return data;
}

export async function fetchOccupancy(days = 30, params = {}) {
  const { data } = await api.get("/analytics/occupancy", { params: { days, ...params } });
  return data;
}
