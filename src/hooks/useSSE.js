// src/hooks/useSSE.js
import { useEffect, useRef } from "react";
import { connectSSE } from "../utils/sseClient";
import { useAuth } from "../context/AuthContext";

export default function useSSE() {
  const { token, role } = useAuth();
  const esRef = useRef(null);

  useEffect(() => {
    if (!token) {
      console.warn("[SSE] Skipping connection (no token)");
      return;
    }

    // Connect SSE using our helper
    esRef.current = connectSSE(
      token,
      (data) => {
        console.log("[SSE] 🔔 Event received:", data);
        // Here you can add logic: show notifications, update dashboard, etc.
      },
      () => console.log("[SSE] ✅ Stream opened for role:", role),
      (err) => console.warn("[SSE] ⚠️ Stream error:", err)
    );

    // Cleanup on unmount
    return () => {
      try {
        esRef.current?.close();
        console.log("[SSE] 🔌 Closed connection");
      } catch {}
    };
  }, [token, role]);
}
