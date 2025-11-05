// src/hooks/useSSE.js
import { useEffect, useRef } from "react";
import { connectSSE } from "../sseClient";
import { useAuth } from "../context/AuthContext";

/* ---------- helpers ---------- */
// normalize anything (Bearer token, object, JSON string) → bare JWT
function toJwtString(input) {
  try {
    if (!input) return "";
    if (typeof input === "string") {
      const s = input.trim();
      if (s.startsWith("{")) return toJwtString(JSON.parse(s));           // JSON string → object
      if (/^Bearer\s+/i.test(s)) return s.replace(/^Bearer\s+/i, "").trim(); // strip "Bearer "
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

export default function useSSE() {
  const { token: ctxToken, role } = useAuth();

  // store current connection & the exact jwt used to open it
  const connRef = useRef(null);
  const jwtRef = useRef("");

  useEffect(() => {
    const jwt = toJwtString(ctxToken);
    const scope = String(role || "").toUpperCase().includes("ADMIN") ? "admin" : "user";

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

    // if same jwt already connected → do nothing
    if (connRef.current && jwtRef.current === jwt) return;

    // token changed → close previous before opening a new one
    if (connRef.current) {
      try { connRef.current.close(); } catch {}
      connRef.current = null;
      console.debug("[SSE] Reconnecting with new token…");
    }

    const { eventSource, cancel } = connectSSE({
      token: jwt,           // ← always a clean JWT string
      scope,                // "admin" for admin roles, else "user"
      onOpen: () => console.log("[SSE] ✅ Stream opened (scope:", scope, ")"),
      onMessage: (data) => {
        // handle both custom and default events (init/notification/etc.)
        console.log("[SSE] 🔔 Event:", data);
      },
      onError: (err, attempt) => {
        console.warn(`[SSE] ⚠️ Error (attempt ${attempt}). Will retry…`, err);
      },
    });

    // keep a uniform .close() interface
    connRef.current = { close: cancel, es: eventSource };
    jwtRef.current = jwt;

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
  }, [ctxToken, role]);
}
