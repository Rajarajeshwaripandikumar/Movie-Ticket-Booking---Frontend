// src/hooks/sseClient.js
/**
 * Robust SSE client with:
 * - Named event support ("notification", "init", ...)
 * - Default message channel handling
 * - Optional jittered exponential backoff (browser retry is not always enough)
 * - Heartbeat watchdog to recover from silent stalls
 * - Clean JSON parsing (tolerant)
 * - cancel() closes and cleans timers/listeners
 *
 * Usage:
 *   const s = connectSSE({ token, onMessage, onOpen, onError, pauseWhenHidden: true });
 *   // optionally s.reconnect();
 *   // when done: s.cancel();
 */
export function connectSSE({
  token,
  scope = "user",
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,          // (data, meta)
  onError,            // (error, attempt)
  withCredentials = false,
  pauseWhenHidden = false,

  // reconnect/backoff controls
  backoff = true,
  minDelay = 1000,
  maxDelay = 30000,
  heartbeatTimeout = 45000, // ms without events -> recycle
} = {}) {
  const jwt = toJwtString(token);
  if (!jwt) throw new Error("[sseClient] token is required");

  let attempt = 0;
  let es = null;
  let disposed = false;
  let heartbeatTimer = null;
  let lastBeat = Date.now();
  let visibilityHandler = null;
  let reconnectTimer = null;

  // keep references to attached listeners so we can remove them later
  let attachedListeners = [];

  const base = `${urlBase.replace(/\?+.*$/, "")}?token=${encodeURIComponent(jwt)}&scope=${encodeURIComponent(scope)}`;

  function safeCall(fn, ...args) {
    try {
      if (typeof fn === "function") fn(...args);
    } catch (err) {
      // do not throw from user callbacks
      // eslint-disable-next-line no-console
      console.error("[sseClient] callback error:", err);
    }
  }

  function touch() {
    lastBeat = Date.now();
  }

  function parsePayload(raw) {
    if (raw == null) return raw;
    if (typeof raw !== "string") return raw;
    // ignore very small heartbeats
    const t = raw.trim();
    if (!t) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function deliver(payload, evt) {
    // ignore known heartbeat tokens
    if (payload === "ping" || payload === ":keep-alive" || payload === "💓" || payload === ": hello") {
      return;
    }
    const data = parsePayload(payload);
    safeCall(onMessage, data, {
      type: evt?.type || "message",
      lastEventId: evt?.lastEventId ?? null,
      originalEvent: evt || null,
    });
  }

  function attachListeners(currentEs) {
    // store refs so we can remove later
    attachedListeners = [];

    // default onopen
    const openHandler = () => {
      attempt = 0;
      touch();
      safeCall(onOpen);
      armHeartbeatWatchdog();
      // eslint-disable-next-line no-console
      console.debug?.("[SSE] connected", { scope, urlBase });
    };
    currentEs.onopen = openHandler;
    attachedListeners.push({ type: "open", fn: openHandler, method: "onopen" });

    // default onmessage (data event)
    const messageHandler = (evt) => {
      touch();
      deliver(evt?.data, evt);
    };
    currentEs.onmessage = messageHandler;
    attachedListeners.push({ type: "message", fn: messageHandler, method: "onmessage" });

    // named events — attach with addEventListener so multiple types supported
    const named = ["notification", "init", "error", "warning", "info"];
    named.forEach((name) => {
      const handler = (evt) => {
        touch();
        deliver(evt?.data, evt);
      };
      currentEs.addEventListener(name, handler);
      attachedListeners.push({ type: name, fn: handler, method: "addEventListener" });
    });

    // error handling
    const errorHandler = (err) => {
      // don't bubble up huge error objects
      safeCall(onError, err, attempt);
      // touch so watchdog isn't too aggressive on transient errors
      touch();
      // if browser closed the connection, schedule reconnect if using backoff
      try {
        if (backoff && currentEs && currentEs.readyState === EventSource.CLOSED) {
          scheduleReconnect();
        }
      } catch (e) {
        scheduleReconnect();
      }
      // eslint-disable-next-line no-console
      console.debug?.("[SSE] error event", err);
    };
    currentEs.onerror = errorHandler;
    attachedListeners.push({ type: "error", fn: errorHandler, method: "onerror" });
  }

  function detachListeners(currentEs) {
    if (!currentEs) return;
    try {
      // remove named listeners registered with addEventListener
      for (const l of attachedListeners) {
        try {
          if (l.method === "addEventListener") currentEs.removeEventListener(l.type, l.fn);
          else if (l.method === "onmessage") currentEs.onmessage = null;
          else if (l.method === "onopen") currentEs.onopen = null;
          else if (l.method === "onerror") currentEs.onerror = null;
        } catch (e) {
          // ignore
        }
      }
    } finally {
      attachedListeners = [];
    }
  }

  function cleanupES() {
    clearHeartbeat();
    if (es) {
      try {
        detachListeners(es);
      } catch (e) {}
      try {
        es.close();
      } catch (e) {}
      es = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function open() {
    if (disposed) return;
    cleanupES();

    // increment seed on retries to avoid caching/proxy sticky issues
    const seed = attempt > 0 ? attempt : Date.now();
    const url = `${base}&seed=${encodeURIComponent(seed)}`;

    try {
      es = new EventSource(url, { withCredentials });
    } catch (err) {
      // older browsers may throw when options not supported — fallback
      try {
        es = new EventSource(url);
      } catch (err2) {
        safeCall(onError, err2, attempt);
        scheduleReconnect();
        return;
      }
    }

    // attach listeners (keeps refs for removal)
    attachListeners(es);
  }

  function computeBackoffDelayLocal(attemptNum) {
    // exponential with cap + jitter (0..33%)
    const exp = Math.min(maxDelay, minDelay * Math.pow(2, Math.max(0, attemptNum - 1)));
    const jitter = exp * (Math.random() * 0.33);
    return Math.min(maxDelay, Math.floor(exp + jitter));
  }

  function scheduleReconnect() {
    if (disposed) return;
    cleanupES();
    attempt += 1;
    const delay = computeBackoffDelayLocal(attempt);
    // eslint-disable-next-line no-console
    console.debug?.(`[SSE] scheduling reconnect in ${delay}ms (attempt ${attempt})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (disposed) return;
      open();
    }, delay);
  }

  function armHeartbeatWatchdog() {
    clearHeartbeat();
    if (!heartbeatTimeout || heartbeatTimeout <= 0) return;
    heartbeatTimer = setInterval(() => {
      if (disposed) return clearHeartbeat();
      const silentFor = Date.now() - lastBeat;
      if (silentFor > heartbeatTimeout) {
        // eslint-disable-next-line no-console
        console.warn?.("[SSE] heartbeat timeout — recycling connection");
        scheduleReconnect();
      }
    }, Math.max(1000, Math.floor(heartbeatTimeout / 3)));
  }

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // Optional visibility pause/resume
  if (pauseWhenHidden && typeof document !== "undefined") {
    visibilityHandler = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        // eslint-disable-next-line no-console
        console.debug?.("[SSE] visibility: hidden — pausing connection");
        cleanupES();
      } else {
        // eslint-disable-next-line no-console
        console.debug?.("[SSE] visibility: visible — resuming connection");
        attempt = 0;
        open();
      }
    };
    try {
      document.addEventListener("visibilitychange", visibilityHandler);
    } catch {}
  }

  // Start the connection
  open();

  // public API
  const cancel = () => {
    disposed = true;
    cleanupES();
    if (visibilityHandler && typeof document !== "undefined") {
      try {
        document.removeEventListener("visibilitychange", visibilityHandler);
      } catch {}
      visibilityHandler = null;
    }
    // eslint-disable-next-line no-console
    console.debug?.("[SSE] connection closed by cancel()");
  };

  const reconnect = () => {
    if (disposed) return;
    attempt = 0;
    cleanupES();
    open();
  };

  const getEventSource = () => es;

  return { cancel, reconnect, getEventSource };
}

/* ---------------- helpers ---------------- */
function toJwtString(v) {
  try {
    if (!v) return "";
    if (typeof v === "string") return v.replace(/^Bearer\s+/i, "").trim();
    if (typeof v === "object") return toJwtString(v.token || v.jwt || v.access_token || v.Authorization);
    return "";
  } catch {
    return "";
  }
}
