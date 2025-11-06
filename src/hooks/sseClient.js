/**
 * Lightweight SSE client with:
 *  - token in query string (?token=...); auto-cleans "Bearer ..." and objects
 *  - optional scope (?scope=admin|user)
 *  - auto-reconnect with exponential backoff + jitter
 *  - cancel() to close/stop retries (clears pending timers)
 *  - JSON-safe onMessage (falls back to raw text if not JSON)
 *  - optional pauseWhenHidden (no reconnect spam when tab hidden)
 */
export function connectSSE({
  token,
  scope = "user",
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,
  onError,
  maxDelayMs = 15000,          // cap for backoff delay
  withCredentials = false,     // EventSource option (browser support varies)
  pauseWhenHidden = false,     // pause auto-reconnect on hidden tab
}) {
  const jwt = toJwtString(token);
  if (!jwt) {
    throw new Error("[sseClient] token is required (got empty/invalid)");
  }

  let es = null;
  let cancelled = false;
  let attempt = 0;
  let reconnectTimer = null;
  let visibilityHandler = null;

  const buildUrl = () =>
    `${urlBase}?token=${encodeURIComponent(jwt)}&scope=${encodeURIComponent(scope || "user")}`;

  const scheduleReconnect = () => {
    // Skip reconnects if cancelled or (optionally) tab is hidden
    if (cancelled) return;
    if (pauseWhenHidden && document.visibilityState === "hidden") return;

    const delay = Math.min(maxDelayMs, 500 * 2 ** Math.min(attempt, 6));
    const jitter = Math.floor(Math.random() * 250);
    const wait = delay + jitter;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, wait);
  };

  const open = () => {
    if (cancelled) return;

    // If an instance is still open (rare), don't stack
    if (es && es.readyState === 1 /* OPEN */) return;

    const url = buildUrl();
    es = new EventSource(url, { withCredentials });

    es.onopen = () => {
      attempt = 0; // reset retry state on success
      try { onOpen && onOpen(); } catch (e) { console.warn("[sseClient] onOpen handler error:", e); }
    };

    es.onmessage = (evt) => {
      const s = evt?.data ?? "";
      // Ignore common heartbeat pings to avoid unnecessary work/logs
      if (s === ":keep-alive" || s === "💓" || s === "ping") return;

      try {
        const parsed = (typeof s === "string" && s.length) ? safeJson(s) : null;
        onMessage && onMessage(parsed ?? s ?? null, evt?.type || "message");
      } catch (e) {
        console.warn("[sseClient] onMessage handler error:", e);
      }
    };

    // Optional: handle named events if your server emits them
    const pass = (type) => (evt) => {
      try {
        const parsed = evt?.data ? (safeJson(evt.data) ?? evt.data) : null;
        onMessage && onMessage(parsed, type);
      } catch {}
    };
    es.addEventListener("notification", pass("notification"));
    es.addEventListener("init", pass("init"));
    es.addEventListener("connected", pass("connected"));
    es.addEventListener("error", pass("error-event")); // custom "error" event, not the same as onerror

    es.onerror = (err) => {
      attempt += 1;
      try { onError && onError(err, attempt); } catch (e) { console.warn("[sseClient] onError handler error:", e); }

      try { es.close(); } catch {}
      es = null;
      scheduleReconnect();
    };
  };

  // Initial open
  open();

  // Optional: pause auto-retry while tab is hidden to avoid reconnect storms
  if (pauseWhenHidden && typeof document !== "undefined") {
    visibilityHandler = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible" && !es) {
        // reset attempt so we don't wait max delay after returning
        attempt = Math.max(0, attempt - 1);
        scheduleReconnect();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  const cancel = () => {
    cancelled = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;

    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }

    if (es) {
      try { es.close(); } catch {}
      es = null;
    }
  };

  return { eventSource: es, cancel };
}

/* ---------------------------- helpers ---------------------------- */
function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// Normalize anything (Bearer token, object, JSON string) → bare JWT
function toJwtString(input) {
  try {
    if (!input) return "";
    if (typeof input === "string") {
      const s = input.trim();
      if (s.startsWith("{")) return toJwtString(JSON.parse(s));               // JSON string → object
      if (/^Bearer\s+/i.test(s)) return s.replace(/^Bearer\s+/i, "").trim();  // strip "Bearer "
      return s;
    }
    if (typeof input === "object") {
      const v =
        input.token ||
        input.jwt ||
        input.access_token ||
        (typeof input.Authorization === "string"
          ? input.Authorization.replace(/^Bearer\s+/i, "").trim()
          : "") ||
        "";
      return toJwtString(v);
    }
    return "";
  } catch {
    return "";
  }
}
