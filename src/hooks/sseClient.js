// src/hooks/sseClient.js
/**
 * Robust SSE client (improved)
 *
 * Features:
 * - Named event support ("notification", "init", ...)
 * - Default message handling and tolerant JSON parsing
 * - Optional jittered exponential backoff (browser retry sometimes insufficient)
 * - Heartbeat watchdog to recover from silent stalls
 * - pauseWhenHidden support
 * - Auto token discovery via getAuthFromStorage() if token not supplied
 * - Exposes cancel(), reconnect(), getEventSource(), state()
 *
 * Usage:
 *   const s = connectSSE({ onMessage, onOpen, onError });
 *   s.reconnect();
 *   s.cancel();
 */
import { apiUrl, getAuthFromStorage, COOKIE_AUTH } from "../api/api";

/* -------------------------- connectSSE -------------------------- */
export function connectSSE({
  token,
  scope = "user",
  urlBase = null, // defaults to apiUrl("/notifications/stream")
  onOpen,
  onMessage, // (data, meta)
  onError, // (error, attempt)
  onState, // optional callback called with state updates
  withCredentials = undefined, // if undefined, respects COOKIE_AUTH
  pauseWhenHidden = false,

  // reconnect/backoff controls
  backoff = true,
  minDelay = 1000,
  maxDelay = 30000,
  heartbeatTimeout = 45000, // ms without events -> recycle
} = {}) {
  // resolve defaults
  const resolvedUrlBase = urlBase || (typeof apiUrl === "function" ? apiUrl("/notifications/stream") : "");
  const resolvedWithCredentials = withCredentials === undefined ? !!COOKIE_AUTH : !!withCredentials;

  // if no explicit token, try storage
  const maybe = token || (getAuthFromStorage && getAuthFromStorage().token) || "";
  const jwt = toJwtString(maybe);
  if (!jwt) {
    // Allow connecting without token only if backend supports cookie sessions
    if (!resolvedWithCredentials) {
      throw new Error("[sseClient] token is required (or enable cookie-based auth)");
    }
  }

  let attempt = 0;
  let es = null;
  let disposed = false;
  let heartbeatTimer = null;
  let lastBeat = Date.now();
  let visibilityHandler = null;
  let reconnectTimer = null;

  // store attached listeners so we can remove them precisely
  let attachedListeners = [];

  // seed URL (strip query + append token & scope)
  const base = `${resolvedUrlBase.replace(/\?+.*$/, "")}${
    resolvedUrlBase.includes("?") ? "&" : "?"
  }scope=${encodeURIComponent(scope)}${jwt ? `&token=${encodeURIComponent(jwt)}` : ""}`;

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
    emitState();
  }

  function parsePayload(raw) {
    if (raw == null) return raw;
    if (typeof raw !== "string") return raw;
    const t = raw.trim();
    if (!t) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function deliver(payload, evt) {
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
    attachedListeners = [];

    // onopen
    const openHandler = (evt) => {
      attempt = 0;
      touch();
      safeCall(onOpen, evt);
      armHeartbeatWatchdog();
      // eslint-disable-next-line no-console
      console.debug?.("[SSE] connected", { scope, urlBase: resolvedUrlBase });
    };
    currentEs.onopen = openHandler;
    attachedListeners.push({ method: "onopen", type: "open", fn: openHandler });

    // onmessage
    const messageHandler = (evt) => {
      touch();
      deliver(evt?.data, evt);
    };
    currentEs.onmessage = messageHandler;
    attachedListeners.push({ method: "onmessage", type: "message", fn: messageHandler });

    // named events
    const named = ["notification", "init", "error", "warning", "info"];
    named.forEach((name) => {
      const handler = (evt) => {
        touch();
        deliver(evt?.data, evt);
      };
      try {
        currentEs.addEventListener(name, handler);
        attachedListeners.push({ method: "addEventListener", type: name, fn: handler });
      } catch (e) {
        // skip if not supported
      }
    });

    // onerror
    const errorHandler = (err) => {
      safeCall(onError, err, attempt);
      touch();
      // schedule reconnect when closed
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
    attachedListeners.push({ method: "onerror", type: "error", fn: errorHandler });

    emitState();
  }

  function detachListeners(currentEs) {
    if (!currentEs) return;
    try {
      for (const l of attachedListeners.slice()) {
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
      emitState();
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
    emitState();
  }

  function open() {
    if (disposed) return;
    cleanupES();

    // seed query param to avoid caching/proxy sticky issues
    const seed = attempt > 0 ? attempt : Date.now();
    const url = `${base}${base.includes("?") ? "&" : "?"}seed=${encodeURIComponent(seed)}`;

    try {
      es = new EventSource(url, { withCredentials: resolvedWithCredentials });
    } catch (err) {
      // fallback for older browsers that ignore options
      try {
        es = new EventSource(url);
      } catch (err2) {
        safeCall(onError, err2, attempt);
        scheduleReconnect();
        return;
      }
    }

    attachListeners(es);
  }

  function computeBackoffDelayLocal(attemptNum) {
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
    emitState();
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

  // visibility pause/resume
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

  // start
  open();

  function emitState() {
    try {
      if (typeof onState === "function") {
        onState({ attempt, readyState: es?.readyState ?? (disposed ? -1 : 0), lastBeat, disposed });
      }
    } catch (e) {}
  }

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
    emitState();
  };

  const reconnect = () => {
    if (disposed) return;
    attempt = 0;
    cleanupES();
    open();
    emitState();
  };

  const getEventSource = () => es;

  const state = () => ({ attempt, readyState: es?.readyState ?? (disposed ? -1 : 0), lastBeat, disposed });

  return { cancel, reconnect, getEventSource, state };
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
