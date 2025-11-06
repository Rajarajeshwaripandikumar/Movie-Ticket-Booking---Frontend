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
    if (evt.data === "ping" || evt.data === ":keep-alive" || evt.data === "💓") return; // ignore heartbeats
    let parsed = evt.data;
    try { parsed = JSON.parse(parsed); } catch {}
    onMessage?.(parsed);
  };

  // ✅ Never close or recreate — let browser do automatic reconnect
  es.onerror = (err) => {
    console.debug("[SSE] ⚠️ transient network issue — browser will auto-retry");
    onError?.(err);
    // do nothing
  };

  const cancel = () => {
    try { es.close(); } catch {}
    console.debug("[SSE] 🔌 closed manually");
  };

  // Optional: pause reconnects when hidden
  if (pauseWhenHidden && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        console.debug("[SSE] ▶️ tab visible — keep active connection");
      }
    });
  }

  return { eventSource: es, cancel };
}

/* utilities */
function toJwtString(input) {
  try {
    if (typeof input === "string") return input.replace(/^Bearer\s+/i, "").trim();
    if (typeof input === "object") return toJwtString(input.token || input.jwt || input.access_token);
    return "";
  } catch { return ""; }
}
