// src/utils/sseClient.js
// Usage:
// const controller = connectSSE(token, onMessage, { onOpen, onStatus, onError, lastEventId });
// controller.close();

const DEFAULTS = {
  maxRetries: 8,
  initialRetryMs: 1000, // 1s
  maxRetryMs: 30_000, // 30s
  jitter: 0.2, // 20% jitter
  heartbeatIntervalMs: 30_000, // 30s - optional client-side check
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
 * @param {string} token - JWT or auth token (optional if using cookie-based auth)
 * @param {(data:any)=>void} onMessage - message handler for parsed JSON payloads
 * @param {object} options - optional callbacks + config
 * @param {(ev)=>void} options.onOpen
 * @param {(err)=>void} options.onError
 * @param {(status)=>void} options.onStatus - receives 'connecting'|'connected'|'reconnecting'|'closed'
 * @param {string} options.baseUrl - override API base
 * @param {number} options.lastEventId - resume from id
 * @param {object} options.clientOptions - override DEFAULTS
 *
 * @returns {object} controller with .close() and `.isClosed`
 */
export function connectSSE(
  token,
  onMessage,
  {
    onOpen,
    onError,
    onStatus,
    baseUrl,
    lastEventId,
    clientOptions = {},
    // If you explicitly want to force token-in-query even if polyfill exists, set this to true.
    allowTokenInQuery = false,
  } = {}
) {
  const cfg = { ...DEFAULTS, ...clientOptions };

  const base =
    baseUrl ||
    import.meta.env.VITE_API_BASE_URL ||
    "https://movie-ticket-booking-backend-o1m2.onrender.com";

  const endpoint = "/api/notifications/stream";
  let closed = false;
  let es = null;
  let retryCount = 0;
  let heartbeatTimer = null;

  // helper to notify status
  const setStatus = (s) => {
    try {
      if (onStatus) onStatus(s);
    } catch (_) {}
    console.log(`[SSE] status: ${s}`);
  };

  // create the EventSource instance, prefer polyfill if available and token present
  function makeEventSource(url, opts = {}) {
    // If a polyfill supporting headers is available, use it:
    // - Example polyfill: `event-source-polyfill` provides `EventSourcePolyfill`.
    const ESPoly = window.EventSourcePolyfill || window.EventSource && window.EventSource.polyfillPlaceholder;
    if (token && (ESPoly && !allowTokenInQuery)) {
      // EventSource polyfill accepted options like headers
      try {
        console.log("[SSE] Using EventSource polyfill (headers) to avoid token-in-query.");
        // EventSourcePolyfill signature: new EventSourcePolyfill(url, { headers: { Authorization: 'Bearer ...' }, ... })
        return new window.EventSourcePolyfill(url, {
          headers: { Authorization: `Bearer ${token}` },
          // If polyfill supports lastEventId option:
          lastEventId: opts.lastEventId,
          heartbeatTimeout: cfg.heartbeatIntervalMs * 2,
        });
      } catch (err) {
        console.warn("[SSE] Polyfill instantiation failed, falling back to native EventSource:", err);
      }
    }

    // Fallback: native EventSource (can't send headers) -> token may be in query string
    return new EventSource(url);
  }

  // Build URL (token-in-query only if necessary)
  function buildUrl() {
    const q = new URLSearchParams();
    if (lastEventId) q.set("lastEventId", lastEventId);
    // Only put token in query if polyfill not available or allowTokenInQuery is set
    const useQueryToken = Boolean(token && (allowTokenInQuery || !window.EventSourcePolyfill));
    if (useQueryToken) q.set("token", token);
    const qs = q.toString();
    return `${base}${endpoint}${qs ? `?${qs}` : ""}`;
  }

  async function start() {
    if (closed) return;
    setStatus(retryCount === 0 ? "connecting" : "reconnecting");

    const url = buildUrl();
    console.log("[SSE] Connecting to:", url);

    try {
      es = makeEventSource(url, { lastEventId });

      es.onopen = (e) => {
        retryCount = 0;
        setStatus("connected");
        console.log("[SSE] ✅ Connected to notifications stream");
        if (onOpen) {
          try {
            onOpen(e);
          } catch (err) {
            console.warn("[SSE] onOpen handler threw:", err);
          }
        }
        // start heartbeat watcher (optional)
        startHeartbeat();
      };

      es.onmessage = (e) => {
        resetHeartbeat();
        // If server sends events with named event types, they come through as MessageEvent
        try {
          const parsed = e.data ? JSON.parse(e.data) : null;
          if (onMessage) onMessage(parsed, e);
        } catch (err) {
          // Non-JSON payloads are allowed; pass raw
          console.warn("[SSE] Non-JSON message:", e.data);
          if (onMessage) onMessage(e.data, e);
        }
      };

      es.onerror = (err) => {
        // Note: native EventSource doesn't expose HTTP status code or reason.
        console.warn("[SSE] Stream error:", err);
        stopHeartbeat();

        // If readyState === EventSource.CLOSED, the browser won't reconnect automatically.
        // We'll try our own reconnect logic below.
        try {
          if (onError) onError(err);
        } catch (e) { /* swallow */ }

        // Attempt reconnect unless explicitly closed
        if (!closed) {
          attemptReconnect();
        }
      };

      // Optional: listen for custom server-sent events (ex: event type "ping" or "auth_error")
      // es.addEventListener("auth_error", (e) => { ... });
    } catch (err) {
      console.error("[SSE] Failed to create EventSource:", err);
      attemptReconnect();
    }
  }

  function attemptReconnect() {
    if (closed) return;
    retryCount += 1;
    if (retryCount > cfg.maxRetries) {
      console.error("[SSE] Max retries reached, giving up.");
      setStatus("closed");
      close();
      return;
    }
    const baseDelay = Math.min(cfg.initialRetryMs * 2 ** (retryCount - 1), cfg.maxRetryMs);
    const delay = applyJitter(baseDelay, cfg.jitter);
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${retryCount}/${cfg.maxRetries})`);
    setStatus("reconnecting");
    // wait and then re-create
    sleep(delay).then(() => {
      if (!closed) {
        // If an old EventSource remains, close it first
        try { if (es && es.close) es.close(); } catch (_) {}
        es = null;
        start();
      }
    });
  }

  // Heartbeat helpers: some servers emit "ping" events; this is a client-side safety
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setTimeout(() => {
      console.warn("[SSE] Heartbeat timeout — no messages received for", cfg.heartbeatIntervalMs);
      // force reconnect to recover
      try { if (es && es.close) es.close(); } catch (_) {}
      attemptReconnect();
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

  function close() {
    closed = true;
    setStatus("closed");
    stopHeartbeat();
    if (es) {
      try { es.close(); } catch (err) { /* ignore */ }
      es = null;
    }
  }

  // start immediately
  start();

  return {
    close,
    get isClosed() { return closed; },
  };
}
