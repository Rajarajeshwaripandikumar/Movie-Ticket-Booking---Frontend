// src/hooks/useNotifications.js
import { useEffect, useRef } from "react";
import api from "../api/api";

/**
 * SSE Notifications Hook
 *
 * Backend stream: GET /api/notifications/stream?token=<JWT>&seed=1&limit=20&scope=user|admin
 * List endpoint:  GET /api/notifications/mine
 * Read endpoint:  PATCH /api/notifications/:id/read
 *
 * Usage:
 *   const { close, reconnect, refreshNow, markRead, markAllRead } = useNotifications(
 *     (evt) => console.log("notification event", evt),
 *     {
 *       scope: "user",        // "user" | "admin"
 *       seed: true,           // ask server to include recent on connect
 *       seedLimit: 20,
 *       onList: (list) => setNotifs(list), // receive fresh list
 *       refreshOnOpen: true,  // fetch list on connect
 *       refreshOnNotify: true,// fetch list after each event (debounced)
 *       refreshDebounceMs: 300
 *     }
 *   );
 */
export default function useNotifications(onMessage, options = {}) {
  const {
    // Prefer same base used by axios client
    baseUrl =
      (api?.defaults?.baseURL ||
        import.meta.env.VITE_API_BASE ||
        import.meta.env.VITE_API_BASE_URL ||
        ""
      ).replace(/\/+$/, ""),
    // Most projects mount router at /api/notifications
    path = "/api/notifications/stream",
    listPath = "/api/notifications/mine",
    readPath = (id) => `/api/notifications/${id}/read`,

    withCredentials = false, // set true only if you use cookie auth (cookie-based)
    scope = "user",          // "user" | "admin"

    // Stream seeding
    seed = true,
    seedLimit = 20,
    extraQuery = {},

    // Autorefresh options for the list endpoint
    onList,                   // callback(listArray)
    refreshOnOpen = true,
    refreshOnNotify = true,
    refreshDebounceMs = 300,

    // Event hooks
    onOpen,
    onError,
  } = options;

  const esRef = useRef(null);
  const retryRef = useRef({ attempts: 0, closed: false, t: null });
  const debounceRef = useRef({ t: null, lastAt: 0 });
  const controlsRef = useRef(null);

  // --- helpers -------------------------------------------------------------

  const getToken = () =>
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token");

  const scheduleDebounced = (fn, ms) => {
    clearTimeout(debounceRef.current.t);
    debounceRef.current.t = setTimeout(() => fn(), ms);
  };

  const refreshList = async () => {
    try {
      const list = await api.getFresh(listPath);
      onList?.(Array.isArray(list) ? list : []);
    } catch (e) {
      // swallow; UI can retry; avoid spamming console
      if (import.meta.env?.DEV) {
        console.warn("[SSE] refresh list failed:", e?.message || e);
      }
    }
  };

  const _markRead = async (id) => {
    try {
      await api.patch(readPath(id), null, {
        headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
        params: { _ts: Date.now() }, // bust intermediary caches
      });
      // After marking read, refresh list quickly (debounced tiny)
      scheduleDebounced(refreshList, Math.min(100, refreshDebounceMs));
    } catch (e) {
      if (import.meta.env?.DEV) {
        console.warn("[SSE] markRead failed:", id, e?.message || e);
      }
    }
  };

  const _markAllRead = async (ids = []) => {
    try {
      // parallel best-effort
      await Promise.all((ids || []).map((id) => api.patch(readPath(id))));
      scheduleDebounced(refreshList, Math.min(120, refreshDebounceMs));
    } catch (e) {
      if (import.meta.env?.DEV) {
        console.warn("[SSE] markAllRead failed:", e?.message || e);
      }
    }
  };

  // --- connect -------------------------------------------------------------

  const connect = () => {
    const token = getToken();
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
      if (refreshOnOpen) scheduleDebounced(refreshList, 10);
    };

    // deliver payload (named "notification" or default message)
    const deliver = (e) => {
      if (!e?.data) return;
      try {
        onMessage?.(JSON.parse(e.data));
      } catch {
        onMessage?.(e.data);
      }
      if (refreshOnNotify) scheduleDebounced(refreshList, refreshDebounceMs);
    };

    es.addEventListener("notification", deliver);
    es.addEventListener("connected", () => {}); // hello/no-op
    es.onmessage = deliver;

    es.onerror = (e) => {
      onError?.(e);
      try { es.close(); } catch {}
      esRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, ... up to 30s, with jitter
      const next = Math.min(1000 * 2 ** Math.max(0, retryRef.current.attempts), 30000);
      const jitter = Math.floor(Math.random() * 400);
      const delay = next + jitter;

      const scheduleReconnect = () => {
        if (retryRef.current.closed) return;
        retryRef.current.attempts++;
        clearTimeout(retryRef.current.t);
        retryRef.current.t = setTimeout(connect, delay);
      };

      if (document.visibilityState === "hidden") {
        const onVisible = () => {
          document.removeEventListener("visibilitychange", onVisible);
          scheduleReconnect();
        };
        document.addEventListener("visibilitychange", onVisible);
      } else {
        scheduleReconnect();
      }
    };
  };

  // --- lifecycle -----------------------------------------------------------

  useEffect(() => {
    connect();
    return () => {
      retryRef.current.closed = true;
      clearTimeout(retryRef.current.t);
      clearTimeout(debounceRef.current.t);
      try { esRef.current?.close(); } catch {}
      esRef.current = null;
    };
    // Mount once; options read on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- public controls -----------------------------------------------------

  if (!controlsRef.current) {
    controlsRef.current = {
      close: () => {
        retryRef.current.closed = true;
        clearTimeout(retryRef.current.t);
        clearTimeout(debounceRef.current.t);
        try { esRef.current?.close(); } catch {}
        esRef.current = null;
      },
      reconnect: () => {
        retryRef.current.closed = false;
        clearTimeout(retryRef.current.t);
        clearTimeout(debounceRef.current.t);
        retryRef.current.attempts = 0;
        connect();
      },
      getEventSource: () => esRef.current,
      refreshNow: () => refreshList(),
      markRead: (id) => _markRead(id),
      markAllRead: (ids) => _markAllRead(ids),
    };
  }

  return controlsRef.current;
}
