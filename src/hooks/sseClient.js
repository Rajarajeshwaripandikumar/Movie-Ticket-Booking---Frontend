// src/hooks/sseClient.js

/**
 * Stable SSE Client
 * - No forced reconnect loops (browser auto-reconnect only)
 * - Ignores heartbeat pings
 * - Clean JSON parse fallback
 * - cancel() stops stream cleanly
 */
export function connectSSE({
  token,
  scope = "user",
  urlBase = "https://movie-ticket-booking-backend-o1m2.onrender.com/api/notifications/stream",
  onOpen,
  onMessage,
  onError,
  withCredentials = false,
  pauseWhenHidden = false,
}) {
  const jwt = toJwtString(token);
  if (!jwt) throw new Error("[sseClient] token is required");

  const url = `${urlBase}?token=${encodeURIComponent(jwt)}&scope=${encodeURIComponent(scope)}`;
  let es = new EventSource(url, { withCredentials });

  es.onopen = () => {
    console.debug("[SSE] ✅ connected");
    onOpen?.();
  };

  es.onmessage = (evt) => {
    if (!evt?.data) return;
    if (evt.data === "ping" || evt.data === ":keep-alive" || evt.data === "💓") return;

    let parsed = evt.data;
    try { parsed = JSON.parse(parsed); } catch {}
    onMessage?.(parsed, evt.type);
  };

  // ✅ Do not close stream inside onerror — allow native autoretry
  es.onerror = (err) => {
    console.debug("[SSE] ⚠️ transient issue — browser will auto-retry");
    onError?.(err);
  };

  const cancel = () => {
    try { es.close(); } catch {}
    console.debug("[SSE] 🔌 closed manually");
  };

  if (pauseWhenHidden && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && es.readyState === EventSource.CLOSED) {
        es = new EventSource(url, { withCredentials });
      }
    });
  }

  return { eventSource: es, cancel };
}

function toJwtString(v) {
  try {
    if (!v) return "";
    if (typeof v === "string") return v.replace(/^Bearer\s+/i, "").trim();
    if (typeof v === "object") return toJwtString(v.token || v.jwt || v.access_token);
    return "";
  } catch {
    return "";
  }
}
