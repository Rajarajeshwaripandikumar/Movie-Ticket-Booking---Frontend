// api.ts (or api.js)

import axios from "axios";

// *** FIX 1: Use the live Render URL, not localhost ***
const BASE_URL = "https://movie-ticket-booking-backend-o1m2.onrender.com";

export const api = axios.create({
  baseURL: BASE_URL,
  // High timeout (60 seconds) to handle Render cold starts
  timeout: 60000, 
  headers: { "Content-Type": "application/json" },
});

// Simple retry on timeout/network error (max 1–2 retries)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {};
    // Check for timeout or complete network failure
    const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
    const isNetwork = !error.response;
    cfg.__retryCount = cfg.__retryCount || 0;

    if ((isTimeout || isNetwork) && cfg.__retryCount < 2) {
      cfg.__retryCount += 1;
      // short backoff before retry to give the server time to start
      await new Promise(r => setTimeout(r, 1500 * cfg.__retryCount));
      return api(cfg);
    }
    return Promise.reject(error);
  }
);

// Optional helper to call before the first auth action to wake the server
export async function wakeBackend() {
  try {
    // Try a simple GET request (e.g., a non-protected health check route)
    // Using fetch here to prevent the retry logic from firing unnecessarily
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" });
  } catch {
    // Ignore the error if the first nudge fails. The API call will retry anyway.
  }
}
