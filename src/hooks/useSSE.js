// src/hooks/useSSE.js
import { useEffect, useRef } from "react";
import { connectSSE } from "./sseClient.js";
import { useAuth } from "../context/AuthContext";

/* ---------- helpers ---------- */
// normalize anything (Bearer token, object, JSON string) → bare JWT
function toJwtString(input) {
  try {
    if (!input) return "";
    if (typeof input === "string") {
      const s = input.trim();
      if (s.startsWith("{")) return toJwtString(JSON.parse(s));
      if (/^Bearer\s+/i.test(s)) return s.replace(/^Bearer\s+/i, "").trim();
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

/**
 * useSSE({
 *   onNotification: (payload) => { ... }, // called for "notification" events
 *   onInit: (payload) => { ... },         // called for "init" events
 *   onAny: (name, payload, rawEvent) => { ... } // called for every event
 * })
 */
export default function useSSE(options = {}) {
  const { token: ctxToken, role } = useAuth();
  const { onNotification, onInit, onAny } = options;

  // store current connection & the exact jwt used to open it
  const connRef = useRef(null);
  const jwtRef = useRef("");
  const scopeRef = useRef("");
  const hiddenRef = useRef(document.visibilityState === "hidden");

  useEffect(() => {
    const handleVisibility = () => {
      const nowHidden = document.visibilityState === "hidden";
      hiddenRef.current = nowHidden;

      // if hidden → close, if visible → reconnect (using same deps)
      if (nowHidden) {
        if (connRef.current) {
          try { connRef.current.close(); } catch {}
          connRef.current = null;
          console.debug("[SSE] ⏸️ Paused stream (tab hidden)");
        }
      } else {
        // force reconnect by clearing jwtRef so effect body will re-run logic
        // (we'll just let the deps take care of reconnection on next render)
        console.debug("[SSE] ▶️ Tab visible; will ensure stream is open");
        // Manually trigger re-open if we still have a token
        const jwt = toJwtString(ctxToken);
        if (jwt && (!connRef.current || jwtRef.current !== jwt)) {
          openStream(jwt, scopeRef.current);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const jwt = toJwtString(ctxToken);
    const scope = String(role || "").toUpperCase().includes("ADMIN") ? "admin" : "user";
    scopeRef.current = scope;

    // if no usable token → close any existing stream and exit
    if (!jwt) {
      if (connRef.current) {
        try { connRef.current.close(); } catch {}
        connRef.current = null;
        jwtRef.current = "";
        console.debug("[SSE] Closed stream (no token)");
      }
      return;
    }

    // don't open while tab hidden
    if (hiddenRef.current) return;

    // if same jwt already connected → do nothing
    if (connRef.current && jwtRef.current === jwt) return;

    // token changed → close previous before opening a new one
    if (connRef.current) {
      try { connRef.current.close(); } catch {}
      connRef.current = null;
      console.debug("[SSE] Reconnecting with new token…");
    }

    openStream(jwt, scope);

    // cleanup on unmount or when jwt/role changes
    return () => {
      if (connRef.current) {
        try {
          connRef.current.close();
          console.debug("[SSE] 🔌 Closed stream");
        } catch {}
        connRef.current = null;
        jwtRef.current = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxToken, role]);

  /** Open (or reopen) stream with handlers */
  function openStream(jwt, scope) {
    const { eventSource, cancel } = connectSSE({
      token: jwt,           // ← clean JWT string
      scope,                // "admin" or "user"
      // Backoff is implemented inside connectSSE; this handler just logs
      onOpen: () => console.log("[SSE] ✅ Stream opened (scope:", scope, ")"),
      onMessage: (data, rawEvent) => {
        try {
          // Normalized payload
          const { type, event, payload } = normalizeEvent(data, rawEvent);

          // Fire per-event callbacks
          if (type === "init" && typeof onInit === "function") onInit(payload);
          if (type === "notification" && typeof onNotification === "function") onNotification(payload);

          // Fire any-callback
          if (typeof onAny === "function") onAny(type, payload, rawEvent);

          // Emit a browser-wide event so any feature can listen without prop-drilling
          window.dispatchEvent(new CustomEvent("sse:notification", { detail: { type, payload } }));

          console.log("[SSE] 🔔", type, payload);
        } catch (e) {
          console.warn("[SSE] Failed to process event", e, data);
        }
      },
      onError: (err, attempt) => {
        console.warn(`[SSE] ⚠️ Error (attempt ${attempt}). Will retry…`, err);
      },
    });

    // keep a uniform .close() interface
    connRef.current = { close: cancel, es: eventSource };
    jwtRef.current = jwt;
  }

  function normalizeEvent(data, rawEvent) {
    // server may send either string or object; tolerate both
    if (data && typeof data === "object" && ("type" in data || "event" in data)) {
      const type = (data.type || data.event || "").toString().toLowerCase() || "message";
      return { type, event: type, payload: data.payload ?? data.data ?? data };
    }
    // fallback: try JSON parse
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const type = (parsed?.type || parsed?.event || rawEvent?.type || "message").toString().toLowerCase();
      return { type, event: type, payload: parsed?.payload ?? parsed?.data ?? parsed };
    } catch {
      const type = (rawEvent?.type || "message").toLowerCase();
      return { type, event: type, payload: data };
    }
  }
}
