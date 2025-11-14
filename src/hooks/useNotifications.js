// src/hooks/useNotifications.js
import { useEffect, useRef, useCallback } from "react";
import api, { getAuthFromStorage, COOKIE_AUTH } from "../api/api";
import { connectSSE } from "./sseClient";

/**
 * useNotifications(onMessage, options)
 *
 * See original for param docs. Options read on mount (intentionally).
 */
export default function useNotifications(onMessage, options = {}) {
  const {
    // base list + stream paths (keep defaults compatible)
    path = "/notifications/stream",
    listPath = "/notifications/mine",
    readPath = (id) => `/notifications/${id}/read`,

    // token: optional; if omitted we'll use getAuthFromStorage()
    token: explicitToken,

    scope = "user",
    seed = true,
    seedLimit = 20,
    extraQuery = {},

    // stream behavior
    withCredentials = undefined, // undefined => respect COOKIE_AUTH
    pauseWhenHidden = true,

    // list refresh behaviour
    onList,
    refreshOnOpen = true,
    refreshOnNotify = true,
    refreshDebounceMs = 300,
    refreshOnMount = true,

    // callbacks (SSE-level)
    onOpen,
    onError,
  } = options;

  // refs
  const sseRef = useRef(null);
  const retryRef = useRef({ attempts: 0, closed: false, t: null });
  const debounceRef = useRef({ t: null });
  const listRef = useRef({ lastList: null });

  // token getter
  const getToken = useCallback(() => {
    if (explicitToken) return explicitToken;
    const s = getAuthFromStorage?.() || {};
    return s.token || localStorage.getItem("adminToken") || localStorage.getItem("token") || null;
  }, [explicitToken]);

  const scheduleDebounced = useCallback((fn, ms) => {
    clearTimeout(debounceRef.current.t);
    debounceRef.current.t = setTimeout(() => fn(), ms);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const data = await api.getFresh(listPath);
      const list = Array.isArray(data) ? data : data?.data ?? [];
      listRef.current.lastList = list;
      onList?.(list);
    } catch (e) {
      if (import.meta.env?.DEV) {
        console.warn("[useNotifications] refresh list failed:", e?.message || e);
      }
    }
  }, [listPath, onList]);

  const _markRead = useCallback(
    async (id) => {
      try {
        await api.patch(readPath(id), null, {
          headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
          params: { _ts: Date.now() },
        });
        scheduleDebounced(refreshList, Math.min(120, refreshDebounceMs));
      } catch (e) {
        if (import.meta.env?.DEV) {
          console.warn("[useNotifications] markRead failed:", id, e?.message || e);
        }
      }
    },
    [readPath, refreshList, refreshDebounceMs, scheduleDebounced]
  );

  const _markAllRead = useCallback(
    async (ids = []) => {
      try {
        await Promise.all((ids || []).map((id) => api.patch(readPath(id))));
        scheduleDebounced(refreshList, Math.min(140, refreshDebounceMs));
      } catch (e) {
        if (import.meta.env?.DEV) {
          console.warn("[useNotifications] markAllRead failed:", e?.message || e);
        }
      }
    },
    [readPath, refreshList, refreshDebounceMs, scheduleDebounced]
  );

  // build extraQuery for SSE (seed, limit etc.)
  const buildExtraQuery = useCallback(() => {
    const q = { ...(extraQuery || {}) };
    if (seed) q.seed = "1";
    if (seedLimit) q.limit = String(seedLimit);
    return q;
  }, [extraQuery, seed, seedLimit]);

  // connect / disconnect
  const connect = useCallback(() => {
    if (retryRef.current.closed) return;
    const tok = getToken();
    if (!tok && !COOKIE_AUTH) {
      if (import.meta.env?.DEV) console.warn("[useNotifications] no token and cookie auth not enabled — skipping SSE");
      return;
    }

    // close existing
    try {
      sseRef.current?.cancel?.();
    } catch {}

    const qs = buildExtraQuery();

    // pass token via options (sseClient will include token param if present)
    const s = connectSSE({
      token: tok,
      scope,
      urlBase: typeof api.defaults?.baseURL === "string" ? `${api.defaults.baseURL.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}` : path,
      onOpen: (evt) => {
        retryRef.current.attempts = 0;
        onOpen?.(evt);
        if (refreshOnOpen) scheduleDebounced(refreshList, 10);
      },
      onMessage: (data, meta) => {
        // deliver to consumer
        try {
          onMessage?.(data, meta);
        } catch (e) {
          /* swallow */
        }
        if (refreshOnNotify) scheduleDebounced(refreshList, refreshDebounceMs);
      },
      onError: (err, attemptNumber) => {
        onError?.(err, attemptNumber);
        // sseClient already handles reconnect/backoff; we update attempts for compatibility
        retryRef.current.attempts = attemptNumber || retryRef.current.attempts + 1;
      },
      withCredentials: withCredentials === undefined ? COOKIE_AUTH : withCredentials,
      pauseWhenHidden,
      backoff: true,
      minDelay: 1000,
      maxDelay: 30000,
      heartbeatTimeout: 45000,
      extraQuery: qs,
    });

    sseRef.current = s;
  }, [
    buildExtraQuery,
    getToken,
    onMessage,
    onOpen,
    onError,
    path,
    scope,
    pauseWhenHidden,
    refreshDebounceMs,
    refreshList,
    refreshOnNotify,
    refreshOnOpen,
    scheduleDebounced,
    withCredentials,
  ]);

  // effect: mount => connect; unmount => cleanup
  useEffect(() => {
    // optionally prime list on mount
    if (refreshOnMount) refreshList();

    connect();

    return () => {
      retryRef.current.closed = true;
      clearTimeout(retryRef.current.t);
      clearTimeout(debounceRef.current.t);
      try {
        sseRef.current?.cancel?.();
      } catch {}
      sseRef.current = null;
    };
    // intentionally run once on mount (options captured on mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // controls (stable reference)
  const controlsRef = useRef(null);
  if (!controlsRef.current) {
    controlsRef.current = {
      close: () => {
        retryRef.current.closed = true;
        clearTimeout(retryRef.current.t);
        clearTimeout(debounceRef.current.t);
        try {
          sseRef.current?.cancel?.();
        } catch {}
        sseRef.current = null;
      },
      reconnect: () => {
        retryRef.current.closed = false;
        clearTimeout(retryRef.current.t);
        clearTimeout(debounceRef.current.t);
        retryRef.current.attempts = 0;
        connect();
      },
      getEventSource: () => sseRef.current?.getEventSource?.() ?? null,
      refreshNow: () => refreshList(),
      markRead: (id) => _markRead(id),
      markAllRead: (ids) => _markAllRead(ids),
      state: () => ({
        attempts: retryRef.current.attempts,
        open: Boolean(sseRef.current?.getEventSource?.()?.readyState === 1),
        lastList: listRef.current.lastList,
      }),
    };
  }

  return controlsRef.current;
}
