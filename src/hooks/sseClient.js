/**
 * Lightweight SSE client with:
 *  - token in query string (?token=...)
 *  - auto-reconnect with exponential backoff + jitter
 *  - cancel() to close/stop retries
 *  - JSON-safe onMessage (falls back to raw text if not JSON)
 *
 * Usage:
 *   import { connectSSE } from "../utils/sseClient";
 *   const { cancel } = connectSSE({
 *     token,
 *     onOpen: () => console.log("opened"),
 *     onMessage: (data) => console.log("msg", data),
 *     onError: (err, attempt) => console.warn("err", attempt, err),
 *   });
 *   // later: cancel();
 */

export function connectSSE({
  token,
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,
  onError,
  maxDelayMs = 15000, // cap for backoff delay
  withCredentials = false, // EventSource option
}) {
  if (!token) {
    throw new Error("[sseClient] token is required");
  }

  let es = null;
  let cancelled = false;
  let attempt = 0;

  const open = () => {
    if (cancelled) return;

    // Build URL with token
    const url = `${urlBase}?token=${encodeURIComponent(token)}`;
    es = new EventSource(url, { withCredentials });

    es.onopen = () => {
      attempt = 0; // reset retry state on success
      try {
        onOpen && onOpen();
      } catch (e) {
        // swallow handler errors
        console.warn("[sseClient] onOpen handler error:", e);
      }
    };

    es.onmessage = (evt) => {
      try {
        // Try to parse JSON payloads; if it fails, pass raw string
        const payload = evt?.data;
        const parsed = typeof payload === "string" && payload.length
          ? safeJson(payload)
          : null;
        onMessage && onMessage(parsed ?? payload ?? null);
      } catch (e) {
        console.warn("[sseClient] onMessage handler error:", e);
      }
    };

    es.onerror = (err) => {
      attempt += 1;

      try {
        onError && onError(err, attempt);
      } catch (e) {
        console.warn("[sseClient] onError handler error:", e);
      }

      // Close current connection before scheduling a retry
      try { es.close(); } catch {}
      es = null;

      if (cancelled) return;

      // Exponential backoff with jitter
      const delay = Math.min(maxDelayMs, 500 * 2 ** Math.min(attempt, 6));
      const jitter = Math.floor(Math.random() * 250);
      const wait = delay + jitter;

      setTimeout(() => {
        if (!cancelled) open();
      }, wait);
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
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
