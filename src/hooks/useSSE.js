// src/hooks/useSSE.js
import { useEffect, useRef, useState, useCallback } from "react";
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
 *   onAny: (name, payload, rawEvent) => { ... }, // called for every event
 *   historySize: 50,                       // optional event buffer size
 * })
 *
 * Returns: { status, lastEvent, events, reconnect, close, getEventSource }
 */
export default function useSSE(options = {}) {
  const { token: ctxToken, role } = useAuth() || {};
  const { onNotification, onInit, onAny, historySize = 50 } = options;

  // connection refs
  const connRef = useRef(null);
  const jwtRef = useRef("");
  const scopeRef = useRef("");
  const hiddenRef = useRef(
    typeof document !== "undefined" ? document.visibilityState === "hidden" : false
  );

  // state exposed to consumers
  const [status, setStatus] = useState("idle"); // idle | connecting | open | error | closed
  const [events, setEvents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  // stable normalizeEvent
  const normalizeEvent = useCallback((data, rawEvent) => {
    if (data && typeof data === "object" && ("type" in data || "event" in data)) {
      const type = String(data.type || data.event || "").toLowerCase() || "message";
      return { type, payload: data.payload ?? data.data ?? data };
    }
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const type = String(parsed?.type || parsed?.event || rawEvent?.type || "message").toLowerCase();
      return { type, payload: parsed?.payload ?? parsed?.data ?? parsed };
    } catch {
      const type = (rawEvent?.type || "message").toLowerCase();
      return { type, payload: data };
    }
  }, []);

  // internal handler wrappers (stable refs)
  const handleMessageRef = useRef();
  const handleOpenRef = useRef();
  const handleErrorRef = useRef();

  handleMessageRef.current = (data, meta) => {
    try {
      const { type, payload } = normalizeEvent(data, meta);
      const ev = { type, payload, meta, ts: Date.now() };

      // update state
      setLastEvent(ev);
      setEvents((s) => {
        const next = s.concat(ev);
        return next.slice(-historySize);
      });

      // call user callbacks
      if (type === "init" && typeof onInit === "function") onInit(payload);
      if (type === "notification" && typeof onNotification === "function") onNotification(payload);
      if (typeof onAny === "function") onAny(type, payload, meta);

      // emit global event for legacy listeners
      try {
        const custom = new CustomEvent("sse:notification", { detail: { type, payload, meta } });
        window.dispatchEvent(custom);
      } catch {}
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[useSSE] Failed to process event", e, data);
    }
  };

  handleOpenRef.current = (evt) => {
    setStatus("open");
    // eslint-disable-next-line no-console
    console.debug?.("[SSE] Stream opened (scope:", scopeRef.current, ")");
  };

  handleErrorRef.current = (err, attempt) => {
    setStatus("error");
    // eslint-disable-next-line no-console
    console.warn(`[useSSE] Error (attempt ${attempt}).`);
  };

  // openStream wrapped in useCallback
  const openStream = useCallback((jwt, scope) => {
    // guard: avoid double-open for same jwt
    if (connRef.current && jwtRef.current === jwt) return;

    // close existing if any
    if (connRef.current) {
      try {
        connRef.current.close?.();
      } catch {}
      connRef.current = null;
      jwtRef.current = "";
    }

    setStatus("connecting");

    // try connecting and wrap the returned API
    try {
      const s = connectSSE({
        token: jwt,
        scope,
        onOpen: (...args) => handleOpenRef.current?.(...args),
        onMessage: (...args) => handleMessageRef.current?.(...args),
        onError: (...args) => handleErrorRef.current?.(...args),
      });

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
      scopeRef.current = scope;
      setStatus("connecting");
      return wrapper;
    } catch (e) {
      // connectSSE threw — mark error and schedule no connection
      setStatus("error");
      // eslint-disable-next-line no-console
      console.error("[useSSE] connectSSE failed:", e);
      return null;
    }
  }, []);

  // visibility handler: pause/resume stream
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVis = () => {
      const nowHidden = document.visibilityState === "hidden";
      hiddenRef.current = nowHidden;
      if (nowHidden) {
        if (connRef.current) {
          try {
            connRef.current.close?.();
          } catch {}
          connRef.current = null;
          jwtRef.current = "";
          setStatus("closed");
          // eslint-disable-next-line no-console
          console.debug("[SSE] Paused stream (tab hidden)");
        }
      } else {
        // visible again: attempt to reopen if we have a token
        const jwt = toJwtString(ctxToken);
        const scope = String(role || "").toUpperCase().includes("ADMIN") ? "admin" : "user";
        if (jwt) {
          openStream(jwt, scope);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxToken, role, openStream]);

  // main effect — open/close on token or role change
  useEffect(() => {
    const jwt = toJwtString(ctxToken);
    const scope = String(role || "").toUpperCase().includes("ADMIN") ? "admin" : "user";
    scopeRef.current = scope;

    if (!jwt) {
      if (connRef.current) {
        try {
          connRef.current.close?.();
        } catch {}
        connRef.current = null;
        jwtRef.current = "";
        setStatus("closed");
        // eslint-disable-next-line no-console
        console.debug("[SSE] Closed stream (no token)");
      }
      return;
    }

    // don't open while hidden
    if (hiddenRef.current) return;

    // if same jwt connected -> no-op
    if (connRef.current && jwtRef.current === jwt) return;

    // otherwise open new stream
    openStream(jwt, scope);

    // cleanup on unmount or when jwt/role changes
    return () => {
      if (connRef.current) {
        try {
          connRef.current.close?.();
          // eslint-disable-next-line no-console
          console.debug("[SSE] Closed stream (effect cleanup)");
        } catch {}
        connRef.current = null;
        jwtRef.current = "";
        setStatus("closed");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxToken, role, openStream]);

  // public API
  const reconnect = useCallback(() => {
    if (!connRef.current) {
      const jwt = toJwtString(ctxToken);
      const scope = String(role || "").toUpperCase().includes("ADMIN") ? "admin" : "user";
      if (jwt) openStream(jwt, scope);
      return;
    }
    try {
      connRef.current.reconnect?.();
    } catch {}
  }, [ctxToken, role, openStream]);

  const close = useCallback(() => {
    try {
      connRef.current?.close?.();
    } catch {}
    connRef.current = null;
    jwtRef.current = "";
    setStatus("closed");
  }, []);

  const getEventSource = useCallback(() => connRef.current?.getEventSource?.() ?? null, []);

  return {
    status,
    lastEvent,
    events,
    reconnect,
    close,
    getEventSource,
  };
}
