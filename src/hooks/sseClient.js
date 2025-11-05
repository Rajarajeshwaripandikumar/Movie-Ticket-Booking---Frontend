/**
 * Lightweight SSE client with:
 *  - token in query string (?token=...); auto-cleans "Bearer ..." and objects
 *  - optional scope (?scope=admin|user)
 *  - auto-reconnect with exponential backoff + jitter
 *  - cancel() to close/stop retries
 *  - JSON-safe onMessage (falls back to raw text if not JSON)
 *
 * Usage:
 *   const { cancel } = connectSSE({
 *     token,                // string | { token: "..."} | "Bearer ..."
 *     scope: "admin",       // or "user" (default)
 *     onOpen: () => console.log("opened"),
 *     onMessage: (data) => console.log("msg", data),
 *     onError: (err, attempt) => console.warn("err", attempt, err),
 *   });
 */

export function connectSSE({
  token,
  scope = "user",
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,
  onError,
  maxDelayMs = 15000,  // cap for backoff delay
  withCredentials = false, // EventSource option
}) {
  const jwt = toJwtString(token);
  if (!jwt) {
    throw new Error("[sseClient] token is required (got empty/invalid)");
  }

  let es = null;
  let cancelled = false;
  let attempt = 0;

  const open = () => {
    if (cancelled) return;

    // Build URL with token + scope
    const url = `${urlBase}?token=${encodeURIComponent(jwt)}&scope=${encodeURIComponent(scope || "user")}`;
    es = new EventSource(url, { withCredentials });

    es.onopen = () => {
      attempt = 0; // reset retry state on success
      try { onOpen && onOpen(); } catch (e) { console.warn("[sseClient] onOpen handler error:", e); }
    };

    // Default "message" events (server may also send named events we don't bind explicitly)
    es.onmessage = (evt) => {
      try {
        const payload = evt?.data;
        const parsed = typeof payload === "string" && payload.length ? safeJson(payload) : null;
        onMessage && onMessage(parsed ?? payload ?? null, evt?.type || "message");
      } catch (e) {
        console.warn("[sseClient] onMessage handler error:", e);
      }
    };

    // Optional: handle common custom events if server emits them
    es.addEventListener("notification", (evt) => {
      try {
        const parsed = safeJson(evt.data) ?? evt.data;
        onMessage && onMessage(parsed, "notification");
      } catch (e) {}
    });
    es.addEventListener("init", (evt) => {
      try {
        const parsed = safeJson(evt.data) ?? evt.data;
        onMessage && onMessage(parsed, "init");
      } catch (e) {}
    });
    es.addEventListener("connected", (evt) => {
      try {
        const parsed = safeJson(evt.data) ?? evt.data;
        onMessage && onMessage(parsed, "connected");
      } catch (e) {}
    });
    es.addEventListener("error", (evt) => {
      // Some servers emit an "error" event as a custom event (not only onerror)
      try {
        const parsed = evt?.data ? (safeJson(evt.data) ?? evt.data) : null;
        onMessage && onMessage(parsed, "error");
      } catch (e) {}
    });

    es.onerror = (err) => {
      attempt += 1;

      try { onError && onError(err, attempt); } catch (e) { console.warn("[sseClient] onError handler error:", e); }

      try { es.close(); } catch {}
      es = null;

      if (cancelled) return;

      // Exponential backoff with jitter
      const delay = Math.min(maxDelayMs, 500 * 2 ** Math.min(attempt, 6));
      const jitter = Math.floor(Math.random() * 250);
      const wait = delay + jitter;

      setTimeout(() => { if (!cancelled) open(); }, wait);
    };
  };

  open();

  const cancel = () => {
    cancelled = true;
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
