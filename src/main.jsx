// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";

// ✅ Static import for SSE polyfill (works with Vite/ESM)
import { EventSourcePolyfill } from "event-source-polyfill";

// ---- PRIME API & REGISTER SSE POLYFILL BEFORE MOUNT ----
import api, { getAuthFromStorage } from "./api/api";

try {
  const { token } = getAuthFromStorage();
  if (token) {
    api.setAuthToken(token);
    console.debug("[bootstrap] primed axios with token from storage");
  } else {
    console.debug("[bootstrap] no token found in storage");
  }
} catch (e) {
  console.debug("[bootstrap] priming failed", e);
}

// ✅ Register EventSource polyfill on window (no require, no runtime warning)
try {
  if (EventSourcePolyfill) {
    // expose for any code that expects window.EventSourcePolyfill
    window.EventSourcePolyfill = EventSourcePolyfill;

    // optionally patch global EventSource if not present
    if (!window.EventSource) {
      window.EventSource = EventSourcePolyfill;
    }

    console.debug("[bootstrap] EventSourcePolyfill registered on window");
  } else {
    console.warn("[bootstrap] EventSourcePolyfill import returned empty");
  }
} catch (e) {
  console.warn("[bootstrap] polyfill registration failed", e);
}

// ---- MOUNT APP ----
ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthProvider>
);
