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
  const { token: ctxToken, role } = useAuth() || {};
  const { onNotification, onInit, onAny } = options;

  // store current connection & the exact jwt used to open it
  const connRef = useRef(null);
  const jwtRef = useRef("");
  const scopeRef = useRef("");
  const hiddenRef = useRef(
    typeof document !== "undefined" ? document.visibilityState === "hidden" : false
  );

  // visibility handler (kept stable)
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      const nowHidden = document.visibilityState === "hidden";
      hiddenRef.current = nowHidden;

      if (nowHidden) {
        if (connRef.current) {
          try {
            connRef.current.close?.();
          } catch {}
          connRef.current = null;
          jwtRef.current = "";
          console.debug("[SSE] Paused stream (tab hidden)");
        }
      } else {
        // reopen if we have a token
        const jwt = toJwtString(ctxToken);
        if (jwt && (!connRef.current || jwtRef.current !== jwt)) {
          openStream(jwt, scopeRef.current);
        } else {
          // if we have a connection but closed unexpectedly, attempt reconnect
          try {
            connRef.current?.reconnect?.();
          } catch {}
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
        try {
          connRef.current.close?.();
        } catch {}
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
      try {
        connRef.current.close?.();
      } catch {}
      connRef.current = null;
      jwtRef.current = "";
      console.debug("[SSE] Reconnecting with new token…");
    }

    openStream(jwt, scope);

    // cleanup on unmount or when jwt/role changes
    return () => {
      if (connRef.current) {
        try {
          connRef.current.close?.();
          console.debug("[SSE] Closed stream (effect cleanup)");
        } catch {}
        connRef.current = null;
        jwtRef.current = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxToken, role]);

  /** Open (or reopen) stream with handlers */
  function openStream(jwt, scope) {
    // guard: ensure we don't double-open
    if (connRef.current && jwtRef.current === jwt) return;

    const s = connectSSE({
      token: jwt,
      scope,
      onOpen: () => {
        console.debug("[SSE] Stream opened (scope:", scope, ")");
      },
      onMessage: (data, meta) => {
        try {
          const { type, payload } = normalizeEvent(data, meta);

          if (type === "init" && typeof onInit === "function") onInit(payload);
          if (type === "notification" && typeof onNotification === "function") onNotification(payload);
          if (typeof onAny === "function") onAny(type, payload, meta);

          // Emit a browser-wide event for global listeners
          try {
            const ev = new CustomEvent("sse:notification", { detail: { type, payload, meta } });
            window.dispatchEvent(ev);
          } catch {}

          console.debug("[SSE] event:", type, payload);
        } catch (e) {
          console.warn("[SSE] Failed to process event", e, data);
        }
      },
      onError: (err, attempt) => {
        console.warn(`[SSE] Error (attempt ${attempt}). Will retry if policy allows…`, err);
      },
      // keep defaults for backoff/heartbeat; connectSSE will honor COOKIE_AUTH when needed
    });

    // normalize API: ensure we have .close() to match previous code
    const wrapper = {
      close: () => {
        try {
          s.cancel?.();
        } catch {}
      },
      reconnect: () => {
        try {
          s.reconnect?.();
        } catch {}
      },
      getEventSource: () => s.getEventSource?.() ?? null,
      raw: s,
    };

    connRef.current = wrapper;
    jwtRef.current = jwt;
  }

  function normalizeEvent(data, rawEvent) {
    // server may send either string or object; tolerate both
    if (data && typeof data === "object" && ("type" in data || "event" in data)) {
      const type = String(data.type || data.event || "").toLowerCase() || "message";
      return { type, payload: data.payload ?? data.data ?? data };
    }
    // fallback: try JSON parse
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const type = String(parsed?.type || parsed?.event || rawEvent?.type || "message").toLowerCase();
      return { type, payload: parsed?.payload ?? parsed?.data ?? parsed };
    } catch {
      const type = (rawEvent?.type || "message").toLowerCase();
      return { type, payload: data };
    }
  }
}
