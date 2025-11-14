// src/utils/sseClient.js
// Usage:
// const controller = connectSSE(token, onMessage, { onOpen, onStatus, onError, lastEventId });
// controller.close(); controller.reconnect(); controller.state();

import { getAuthFromStorage, BASE_URL, apiUrl } from "../api/api";

const DEFAULTS = {
  maxRetries: 8,
  initialRetryMs: 1000, // 1s
  maxRetryMs: 30_000, // 30s
  jitter: 0.2, // ±20% jitter
  heartbeatIntervalMs: 30_000, // 30s client-side check
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function applyJitter(ms, jitterFraction) {
  const jitter = ms * jitterFraction * (Math.random() * 2 - 1); // ±fraction
  return Math.max(0, Math.floor(ms + jitter));
}

/**
 * Connect to SSE endpoint with reconnection/backoff and optional polyfill headers.
 *
 * @param {string|null} token - JWT or auth token (optional if using cookie-based auth)
 * @param {(payload:any, ev?:MessageEvent)=>void} onMessage - message handler
 * @param {object} options
 *  - onOpen, onError, onStatus
 *  - streamUrl (full URL) OR baseUrl (origin) (if omitted, tries apiUrl("/notifications/stream"))
 *  - lastEventId
 *  - clientOptions: override DEFAULTS
 *  - allowTokenInQuery (force token in query even if polyfill exists)
 *
 * @returns controller { close(), reconnect(), isClosed, getEventSource(), state() }
 */
export function connectSSE(token, onMessage, options = {}) {
  const {
    onOpen,
    onError,
    onStatus,
    streamUrl, // full URL including /api/notifications/stream
    baseUrl, // origin fallback (will append /api/notifications/stream)
    lastEventId,
    clientOptions = {},
    allowTokenInQuery = false,
    // optional: list of extra query params to append
    extraQuery = {},
  } = options;

  const cfg = { ...DEFAULTS, ...(clientOptions || {}) };

  // Resolve stream URL:
  // Prefer explicit streamUrl -> apiUrl('/notifications/stream') -> constructed from BASE_URL
  const resolvedStreamUrl =
    streamUrl ||
    (typeof apiUrl === "function"
      ? apiUrl("/notifications/stream")
      : ((baseUrl || BASE_URL || "").replace(/\/+$/, "") + "/api/notifications/stream"));

  let closed = false;
  let es = null;
  let retryCount = 0;
  let heartbeatTimer = null;
  let lastReceiveAt = Date.now();
  let lastAttemptDelay = 0;

  // expose internal state for debugging
  function reportStatus(s) {
    try {
      if (typeof onStatus === "function") onStatus(s);
    } catch (_) {}
    if (typeof console !== "undefined") console.debug(`[SSE] status: ${s}`);
  }

  // Attempt to create EventSource - prefer polyfill for headers if available
  function makeEventSource(url, opts = {}) {
    const EventSourcePolyfill = window?.EventSourcePolyfill ?? window?.EventSourcePolyfillShim ?? null;
    // Allow user to force token-in-query if they explicitly want it
    const useQueryToken = Boolean(token && (allowTokenInQuery || !EventSourcePolyfill));

    if (EventSourcePolyfill && token && !allowTokenInQuery) {
      try {
        // Many polyfills accept headers and lastEventId
        return new EventSourcePolyfill(url, {
          headers: { Authorization: `Bearer ${token}` },
          lastEventId: opts.lastEventId,
          heartbeatTimeout: cfg.heartbeatIntervalMs * 2,
        });
      } catch (err) {
        console.warn("[SSE] polyfill instantiation failed, falling back to native EventSource", err);
      }
    }

    // Native EventSource (can't set headers) — token may need to be in query
    return new EventSource(url);
  }

  function buildUrl() {
    // If polyfill is not available and token exists, we must include token in query unless allowTokenInQuery=false was used with polyfill
    const EventSourcePolyfill = window?.EventSourcePolyfill ?? null;
    const useQueryToken = Boolean(token && (allowTokenInQuery || !EventSourcePolyfill));

    const u = new URL(resolvedStreamUrl, window?.location?.origin || undefined);
    if (lastEventId) u.searchParams.set("lastEventId", String(lastEventId));
    if (useQueryToken) u.searchParams.set("token", token);
    for (const [k, v] of Object.entries(extraQuery || {})) {
      if (v != null) u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  function startHeartbeat() {
    stopHeartbeat();
    lastReceiveAt = Date.now();
    heartbeatTimer = setTimeout(() => {
      const since = Date.now() - lastReceiveAt;
      if (since >= cfg.heartbeatIntervalMs) {
        console.warn("[SSE] Heartbeat timeout — forcing reconnect");
        safeCloseCurrent();
        scheduleReconnect();
      }
    }, cfg.heartbeatIntervalMs + 1000);
  }
  function resetHeartbeat() {
    if (!heartbeatTimer) return;
    clearTimeout(heartbeatTimer);
    startHeartbeat();
  }
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function safeCloseCurrent() {
    try {
      if (es && typeof es.close === "function") es.close();
    } catch (e) {
      /* ignore */
    } finally {
      es = null;
    }
  }

  async function attemptReconnect() {
    if (closed) return;
    retryCount += 1;
    if (retryCount > cfg.maxRetries) {
      console.error("[SSE] max retries reached — giving up");
      reportStatus("closed");
      close();
      return;
    }
    const baseDelay = Math.min(cfg.initialRetryMs * 2 ** (retryCount - 1), cfg.maxRetryMs);
    const delay = applyJitter(baseDelay, cfg.jitter);
    lastAttemptDelay = delay;
    reportStatus("reconnecting");
    await sleep(delay);
    if (!closed) {
      safeCloseCurrent();
      startInternal();
    }
  }

  function startInternal() {
    if (closed) return;
    reportStatus(retryCount === 0 ? "connecting" : "reconnecting");

    const url = buildUrl();
    if (typeof console !== "undefined") console.debug("[SSE] connecting to", url);

    try {
      es = makeEventSource(url, { lastEventId });

      es.onopen = (ev) => {
        retryCount = 0;
        lastReceiveAt = Date.now();
        reportStatus("connected");
        if (typeof onOpen === "function") {
          try { onOpen(ev); } catch (e) { console.warn("[SSE] onOpen threw:", e); }
        }
        startHeartbeat();
      };

      es.onmessage = (ev) => {
        lastReceiveAt = Date.now();
        resetHeartbeat();
        // attempt to parse JSON; if fails, pass raw
        let parsed = null;
        try {
          parsed = ev.data ? JSON.parse(ev.data) : null;
        } catch {
          parsed = ev.data;
        }
        try {
          onMessage?.(parsed, ev);
        } catch (e) {
          console.warn("[SSE] onMessage handler threw:", e);
        }
      };

      es.onerror = (err) => {
        stopHeartbeat();
        // native EventSource doesn't provide status details; polyfill may.
        console.warn("[SSE] stream error", err);
        try { onError?.(err); } catch (e) { console.warn("[SSE] onError threw:", e); }
        // native EventSource may auto-reconnect; still schedule our own reconnection if closed
        // Use short timeout to avoid tight loop
        if (!closed) attemptReconnect();
      };

      // optional: custom named events can be attached by caller using es.addEventListener(...)
    } catch (err) {
      console.error("[SSE] failed to create EventSource:", err);
      attemptReconnect();
    }
  }

  function start() {
    // If token not provided, try to pick from storage automatically (convenience)
    if (!token) {
      try {
        const stored = getAuthFromStorage && getAuthFromStorage();
        if (stored && stored.token) {
          token = stored.token;
        }
      } catch (_) {}
    }
    closed = false;
    retryCount = 0;
    startInternal();
  }

  function close() {
    closed = true;
    stopHeartbeat();
    safeCloseCurrent();
    reportStatus("closed");
  }

  function reconnect() {
    if (closed) {
      closed = false;
      retryCount = 0;
      start();
      return;
    }
    // active reconnect
    safeCloseCurrent();
    retryCount = 0;
    startInternal();
  }

  function state() {
    return {
      closed,
      retryCount,
      lastReceiveAt,
      lastAttemptDelay,
      readyState: es?.readyState ?? (closed ? -1 : 0),
    };
  }

  function getEventSource() {
    return es;
  }

  // start immediately
  start();

  return {
    close,
    reconnect,
    getEventSource,
    state,
    get isClosed() { return closed; },
  };
}
