// src/hooks/useNotifications.js
import { useEffect, useRef } from "react";
import api from "../api/api";

/**
 * SSE Notifications Hook
 *
 * Backend: GET /api/notifications/stream?token=<JWT>&seed=1&limit=20&scope=user|admin
 *
 * Usage:
 *   const { close, reconnect } = useNotifications(
 *     (n) => console.log("notif", n),
 *     { scope: "user", seed: true, seedLimit: 20 }
 *   );
 */
export default function useNotifications(onMessage, options = {}) {
  const {
    // Prefer same base used by axios client
    baseUrl =
      (api?.defaults?.baseURL || import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "")
        .replace(/\/+$/, ""),
    // Most projects mount router at /api/notifications
    path = "/api/notifications/stream",
    withCredentials = false,    // set true only if you use cookie auth (not needed when using ?token=)
    seed = true,                // request recent on connect
    seedLimit = 20,             // how many to seed
    scope = "user",             // "user" | "admin"
    extraQuery = {},            // any extra query params
    onOpen,
    onError,
  } = options;

  const esRef = useRef(null);
  const retryRef = useRef({ attempts: 0, closed: false, t: null });

  // Expose simple controls via return value
  const controlsRef = useRef({
    close: () => {
      retryRef.current.closed = true;
      clearTimeout(retryRef.current.t);
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
    },
    reconnect: () => {
      retryRef.current.closed = false;
      clearTimeout(retryRef.current.t);
      retryRef.current.attempts = 0;
      connect();
    },
    getEventSource: () => esRef.current,
  });

  // Build and memo connect fn without deps (we capture latest via refs)
  const connect = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("[SSE] No auth token; skipping notifications.");
      return;
    }
    if (retryRef.current.closed) return;

    const qs = new URLSearchParams({
      token,
      ...(seed ? { seed: "1" } : {}),
      ...(seedLimit ? { limit: String(seedLimit) } : {}),
      ...(scope ? { scope } : {}),
    });

    for (const [k, v] of Object.entries(extraQuery || {})) {
      if (v != null) qs.set(k, String(v));
    }

    const url = `${baseUrl}${path}?${qs.toString()}`;
    const es = new EventSource(url, { withCredentials });
    esRef.current = es;

    es.onopen = (e) => {
      retryRef.current.attempts = 0;
      onOpen?.(e);
      // console.log("[SSE] connected");
    };

    // Primary named event
    const handleEvent = (e) => {
      if (!e?.data) return;
      try {
        onMessage?.(JSON.parse(e.data));
      } catch {
        onMessage?.(e.data);
      }
    };

    es.addEventListener("notification", handleEvent);
    es.addEventListener("connected", () => {}); // hello event, no-op
    es.onmessage = handleEvent; // fallback default channel

    es.onerror = (e) => {
      onError?.(e);
      try { es.close(); } catch {}
      esRef.current = null;

      // Backoff: 1s, 2s, 4s, ... capped at 30s + 0–400ms jitter
      const next = Math.min(1000 * 2 ** Math.max(0, retryRef.current.attempts), 30000);
      const jitter = Math.floor(Math.random() * 400);
      const delay = next + jitter;

      // If hidden, wait until visible to schedule reconnect
      if (document.visibilityState === "hidden") {
        const onVisible = () => {
          document.removeEventListener("visibilitychange", onVisible);
          if (retryRef.current.closed) return;
          retryRef.current.attempts++;
          clearTimeout(retryRef.current.t);
          retryRef.current.t = setTimeout(connect, delay);
        };
        document.addEventListener("visibilitychange", onVisible);
        return;
      }

      if (!retryRef.current.closed) {
        retryRef.current.attempts++;
        clearTimeout(retryRef.current.t);
        retryRef.current.t = setTimeout(connect, delay);
      }
    };
  };

  useEffect(() => {
    connect();
    return () => {
      retryRef.current.closed = true;
      clearTimeout(retryRef.current.t);
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
    };
    // Deliberately not depending on function refs; options are read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return controlsRef.current;
}
