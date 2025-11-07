// src/hooks/sseClient.js

/**
 * Robust SSE client with:
 * - Named event support ("notification", "init", ...)
 * - Default message channel handling
 * - Optional jittered exponential backoff (browser retry is not always enough)
 * - Heartbeat watchdog to recover from silent stalls
 * - Clean JSON parsing (tolerant)
 * - cancel() closes and cleans timers/listeners
 */
export function connectSSE({
  token,
  scope = "user",
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,          // (data, rawEvent)
  onError,            // (error, attempt)
  withCredentials = false,
  pauseWhenHidden = false,

  // Reconnect controls
  backoff = true,     // enable jittered exponential backoff on errors/timeouts
  minDelay = 1000,    // 1s initial delay
  maxDelay = 30000,   // 30s cap
  heartbeatTimeout = 45000, // if no event for 45s → recycle connection
}) {
  const jwt = toJwtString(token);
  if (!jwt) throw new Error("[sseClient] token is required");

  let attempt = 0;
  let es = null;
  let disposed = false;
  let heartbeatTimer = null;
  let lastBeat = Date.now();
  let visibilityHandler = null;

  const base = `${urlBase}?token=${encodeURIComponent(jwt)}&scope=${encodeURIComponent(scope)}`;

  // open a connection (optionally varying seed to dodge proxies)
  function open() {
    if (disposed) return;
    const seed = attempt; // helps with some caches; increments on retries
    const url = `${base}&seed=${seed}`;
    cleanupES(); // just in case
    es = new EventSource(url, { withCredentials });

    // ---- event helpers ----
    const touch = () => { lastBeat = Date.now(); };

    const deliver = (payload, evt) => {
      // ignore common heartbeats
      if (payload === "ping" || payload === ":keep-alive" || payload === "💓") return;
      let data = payload;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { /* keep as string */ }
      }
      onMessage?.(data, {
        type: evt?.type || "message",
        lastEventId: evt?.lastEventId ?? null,
        originalEvent: evt || null,
      });
    };

    // ---- open ----
    es.onopen = () => {
      attempt = 0;          // reset backoff on success
      touch();
      onOpen?.();
      console.debug("[SSE] ✅ connected", { scope });
      armHeartbeatWatchdog();
    };

    // ---- default channel ----
    es.onmessage = (evt) => {
      touch();
      deliver(evt?.data, evt);
    };

    // ---- named events (common ones) ----
    const named = ["notification", "init", "error", "warning", "info"];
    named.forEach((name) => {
      es.addEventListener(name, (evt) => {
        touch();
        deliver(evt?.data, evt);
      });
    });

    // ---- errors (do NOT close immediately; browser may auto-retry) ----
    es.onerror = (err) => {
      // Some browsers keep a half-open socket forever; the watchdog will recycle if needed.
      console.debug("[SSE] ⚠️ error event (browser may retry)", err);
      onError?.(err, attempt);
      // We still touch to avoid watchdog firing instantly on transient hiccup
      touch();
      if (!backoff) return; // rely purely on browser retry
      // If readyState is CLOSED, schedule our own reopen with backoff
      if (es.readyState === EventSource.CLOSED) {
        scheduleReconnect();
      }
    };
  }

  function scheduleReconnect() {
    if (disposed) return;
    cleanupES();
    attempt += 1;
    const delay = computeBackoffDelay(attempt, minDelay, maxDelay);
    console.debug(`[SSE] 🔁 reconnecting in ~${Math.round(delay)}ms (attempt ${attempt})`);
    setTimeout(() => {
      if (!disposed) open();
    }, delay);
  }

  function armHeartbeatWatchdog() {
    clearHeartbeat();
    if (!heartbeatTimeout || heartbeatTimeout <= 0) return;
    heartbeatTimer = setInterval(() => {
      if (disposed) return clearHeartbeat();
      const silentFor = Date.now() - lastBeat;
      if (silentFor > heartbeatTimeout) {
        console.warn("[SSE] ⏱️ heartbeat timeout — recycling connection");
        // Recycle connection to recover from silent stalls
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

  function cleanupES() {
    clearHeartbeat();
    if (es) {
      try { es.close(); } catch {}
      es = null;
    }
  }

  // Visibility pause/resume (optional)
  if (pauseWhenHidden && typeof document !== "undefined") {
    visibilityHandler = () => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        console.debug("[SSE] ⏸️ pausing (hidden)");
        cleanupES();
      } else {
        // Resume immediately with fresh seed
        console.debug("[SSE] ▶️ resuming (visible)");
        attempt = 0;
        open();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  // kick off
  open();

  // Public cancel
  const cancel = () => {
    disposed = true;
    cleanupES();
    if (visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityHandler);
    }
    console.debug("[SSE] 🔌 closed manually");
  };

  return { eventSource: es, cancel };
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

function computeBackoffDelay(attempt, minDelay, maxDelay) {
  // Exponential backoff with jitter: base * 2^(n-1), then add 0–33% jitter
  const exp = Math.min(maxDelay, minDelay * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = exp * (Math.random() * 0.33);
  return Math.min(maxDelay, exp + jitter);
}
