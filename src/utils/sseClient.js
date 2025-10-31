// src/utils/sseClient.js
export function connectSSE(token, onMessage, onOpen, onError) {
  if (!token) {
    console.warn("[SSE] No auth token found; skipping notifications.");
    return null;
  }

  // ✅ Backend base URL (Render)
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    "https://movie-ticket-booking-backend-o1m2.onrender.com";

  // Build full SSE URL with token query
  const url = `${base}/api/notifications/stream?token=${encodeURIComponent(token)}`;
  console.log("[SSE] Connecting to:", url);

  // ✅ FIX: Remove 'withCredentials' to avoid CORS rejection
  // Your backend authenticates via JWT in query string,
  // so we don't need cookies/credentials here.
  const es = new EventSource(url);

  // Event handlers
  es.onopen = (e) => {
    console.log("[SSE] ✅ Connected to notifications stream");
    if (onOpen) onOpen(e);
  };

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      console.log("[SSE] 🔔 Message received:", data);
      if (onMessage) onMessage(data);
    } catch (err) {
      console.warn("[SSE] Non-JSON message:", e.data);
    }
  };

  es.onerror = (e) => {
    console.warn("[SSE] ⚠️ Stream error/disconnected:", e);
    if (onError) onError(e);
  };

  return es;
}
