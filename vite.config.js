// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const keyPath = path.resolve(__dirname, "localhost-key.pem");
const certPath = path.resolve(__dirname, "localhost.pem");
const forceHttps = process.env.VITE_FORCE_HTTPS === "true";

let httpsConfig = false;
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    httpsConfig = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    console.log("[vite] Using local HTTPS certs:", keyPath, certPath);
  } catch (err) {
    console.warn("[vite] Failed to read cert files — falling back to HTTP:", err.message);
  }
} else if (forceHttps) {
  throw new Error(
    `[vite] VITE_FORCE_HTTPS=true but cert files not found at:
  ${keyPath}
  ${certPath}
Create them (mkcert/openssl) or unset VITE_FORCE_HTTPS.`
  );
} else {
  console.warn("[vite] Local TLS files not found. Starting dev server over HTTP.");
}

export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsConfig || false,
    port: 5173,
    // ✅ Proxy ONLY API/static paths to the backend
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true, secure: false },
      "/uploads": { target: "http://localhost:8080", changeOrigin: true, secure: false },
    },
    // ❌ Do NOT set historyApiFallback here (that’s for webpack). Vite already falls back to index.html.
  },
});
