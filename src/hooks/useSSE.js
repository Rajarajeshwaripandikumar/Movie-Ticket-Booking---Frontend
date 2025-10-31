// src/hooks/useSSE.js
import { useEffect, useRef } from "react";
import { connectSSE } from "../utils/sseClient";
import { useAuth } from "../context/AuthContext";

/**
 * useSSE()
 * Automatically connects to backend SSE (/api/notifications/stream)
 * when a valid JWT token is available — either from AuthContext or localStorage.
 *
 * Logs all received events to console by default.
 */
export default function useSSE() {
  const { token: ctxToken, role } = useAuth();
  const esRef = useRef(null);

  useEffect(() => {
    // ✅ Use AuthContext token first, fallback to localStorage
    const token =
      ctxToken ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    console.debug("[SSE] Token check → context:", !!ctxToken, "localStorage:", !!localStorage.getItem("token"));

    // If no token found, skip connection
    if (!token) {
      console.warn("[SSE] Skipping connection (no token found in context or localStorage)");
      return;
    }

    // Establish SSE connection via our helper
    esRef.current = connectSSE(
      token,
      (data) => {
        console.log("[SSE] 🔔 Event received:", data);
        // 👉 You can show a toast, refresh dashboard, or update notifications here
      },
      () => console.log("[SSE] ✅ Stream opened for role:", role || "USER"),
      (err) => console.warn("[SSE] ⚠️ Stream error:", err)
    );

    // Cleanup when component unmounts or token changes
    return () => {
      try {
        esRef.current?.close();
        console.log("[SSE] 🔌 Closed connection");
      } catch (e) {
        console.warn("[SSE] Cleanup error:", e);
      }
    };
  }, [ctxToken, role]);
}
