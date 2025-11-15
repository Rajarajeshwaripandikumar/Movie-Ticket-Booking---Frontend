// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";

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

// Register EventSource polyfill on window (ensure installed)
try {
  // If bundler complains, replace with static import: import { EventSourcePolyfill } from 'event-source-polyfill';
  const mod = (() => {
    try { return require("event-source-polyfill"); } catch { return null; }
  })();
  const maybePoly = mod?.EventSourcePolyfill || mod?.EventSource || mod?.default || null;
  if (maybePoly) {
    window.EventSourcePolyfill = maybePoly;
    console.debug("[bootstrap] EventSourcePolyfill registered on window");
  } else {
    console.warn("[bootstrap] EventSourcePolyfill not found — install 'event-source-polyfill' to enable SSE headers");
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
