// api.ts
import axios from "axios";

const BASE_URL = "https://movie-ticket-booking-backend-o1m2.onrender.com/api";

export const api = axios.create({
  baseURL: BASE_URL,
  // Give Render time to wake up (60s is reasonable)
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

// Simple retry on timeout/network error (max 1–2 retries)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {};
    const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
    const isNetwork = !error.response;
    cfg.__retryCount = cfg.__retryCount || 0;

    if ((isTimeout || isNetwork) && cfg.__retryCount < 2) {
      cfg.__retryCount += 1;
      // short backoff before retry
      await new Promise(r => setTimeout(r, 1500 * cfg.__retryCount));
      return api(cfg);
    }
    return Promise.reject(error);
  }
);

// Optional helper to call before first auth action
export async function wakeBackend() {
  try {
    // Try a super-fast ping; don’t block the UI too long
    await fetch(`${BASE_URL}/health`, { method: "GET", cache: "no-store" });
  } catch {
    // ignore — it’s just a nudge to start the dyno
  }
}
