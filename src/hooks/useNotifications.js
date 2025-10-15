// src/hooks/useNotifications.js
import { useEffect, useRef } from "react";

/**
 * Server-Sent Events (SSE) notifications hook
 *
 * - Opens EventSource to /api/notifications/stream with ?token=<JWT>[&seed=1]
 * - Listens to the named "notification" event (your backend emits this)
 * - Handles the default message channel as a fallback
 * - Safer reconnect with jitter; pauses when tab hidden
 *
 * Usage:
 *   useNotifications((n) => toast(`${n.title}: ${n.message}`), { seed: true });
 */
export default function useNotifications(onMessage, options = {}) {
  const {
    baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
    path = "/api/notifications/stream",
    withCredentials = false, // only for cookie-auth servers
    seed = true,             // request recent items on connect
    onOpen,
    onError,
  } = options;

  const esRef = useRef(null);
  const retryRef = useRef({
    attempts: 0,
    closed: false,
    t: null,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("[SSE] No auth token found; skipping notifications.");
      return;
    }

    const scheduleReconnect = () => {
      // backoff: 0s, 2s, 4s, 6s ... max 10s + small jitter
      const baseDelay = Math.min(retryRef.current.attempts * 2000, 10000);
      const jitter = Math.floor(Math.random() * 400); // 0-400ms
      const delay = baseDelay + jitter;
      if (delay) console.log(`[SSE] Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
      clearTimeout(retryRef.current.t);
      retryRef.current.t = setTimeout(connect, delay);
    };

    const connect = () => {
      if (retryRef.current.closed) return;

      const url = `${baseUrl}${path}?token=${encodeURIComponent(token)}${seed ? "&seed=1" : ""}`;
      const es = new EventSource(url, { withCredentials });
      esRef.current = es;

      es.onopen = (e) => {
        retryRef.current.attempts = 0;
        onOpen?.(e);
        console.log("[SSE] connected");
      };

      // Named "notification" events (primary path)
      es.addEventListener("notification", (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage?.(data);
        } catch {
          onMessage?.(e.data);
        }
      });

      // Optional "connected" hello event
      es.addEventListener("connected", (e) => {
        // No-op, but useful for debugging
        // console.log("[SSE] hello", e.data);
      });

      // Fallback default channel (if server ever sends without event name)
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage?.(data);
        } catch {
          onMessage?.(e.data);
        }
      };

      es.onerror = (e) => {
        // This fires on any network drop (including server restarts/timeouts)
        console.warn("[SSE] error", e);
        onError?.(e);

        // Close and schedule reconnect (EventSource also retries, but we prefer our timing)
        try { es.close(); } catch {}
        esRef.current = null;

        // If tab is hidden, don't hammer the server; wait until visible
        if (document.visibilityState === "hidden") {
          const onVisible = () => {
            document.removeEventListener("visibilitychange", onVisible);
            retryRef.current.attempts++;
            scheduleReconnect();
          };
          document.addEventListener("visibilitychange", onVisible);
          return;
        }

        retryRef.current.attempts++;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      retryRef.current.closed = true;
      clearTimeout(retryRef.current.t);
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
    };
  }, [onMessage, baseUrl, path, withCredentials, seed, onOpen, onError]);
}
