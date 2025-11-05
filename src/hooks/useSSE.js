import { useEffect, useRef } from "react";
import { connectSSE } from "../utils/sseClient";
import { useAuth } from "../context/AuthContext";

export default function useSSE() {
  const { token: ctxToken, role } = useAuth();

  // Keep current connection + the token we used to open it
  const esRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    // Prefer context token; avoid racing on localStorage during login
    const token = ctxToken || null;

    // Quietly wait until we have a token
    if (!token) {
      // If a connection exists but token disappeared (logout), close it
      if (esRef.current) {
        try {
          esRef.current.close();
        } catch {}
        esRef.current = null;
        tokenRef.current = null;
        console.debug("[SSE] Closed stream (no token)");
      }
      return;
    }

    // If we already have a live connection for the same token, do nothing
    if (tokenRef.current === token && esRef.current) {
      return;
    }

    // If token changed, close previous connection first
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {}
      esRef.current = null;
      console.debug("[SSE] Reconnecting with new token…");
    }

    // Establish SSE connection
    const { eventSource, cancel } = connectSSE({
      token,
      onOpen: () => console.log("[SSE] ✅ Stream opened for role:", role || "USER"),
      onMessage: (data) => console.log("[SSE] 🔔 Event:", data),
      onError: (err, attempt) =>
        console.warn(`[SSE] ⚠️ Error (attempt ${attempt}). Will retry…`, err),
    });

    esRef.current = { close: cancel }; // expose a uniform .close()
    tokenRef.current = token;

    // Cleanup when token/role changes or component unmounts
    return () => {
      if (esRef.current) {
        try {
          esRef.current.close();
          console.debug("[SSE] 🔌 Closed stream");
        } catch {}
        esRef.current = null;
        tokenRef.current = null;
      }
    };
  }, [ctxToken, role]);
}
