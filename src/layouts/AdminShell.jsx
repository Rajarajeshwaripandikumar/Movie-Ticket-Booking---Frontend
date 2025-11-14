// src/layouts/AdminShell.jsx — Admin shell with optional diagnostics
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import api, { getAuthFromStorage, BASE_URL, apiUrl } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { Terminal } from "lucide-react";

const DEBUG_ADMIN_SHELL = typeof import.meta !== "undefined" && Boolean(import.meta.env?.VITE_ADMIN_SHELL_DEBUG || import.meta.env?.DEV);

function short(s = "") {
  if (!s) return "(none)";
  return typeof s === "string" && s.length > 12 ? s.slice(0, 8) + "…" : s;
}

export default function AdminShell() {
  const auth = useAuth?.() ?? {};
  const [busy, setBusy] = useState(false);
  const [lastDiag, setLastDiag] = useState(null);

  async function runDiagnostics() {
    setBusy(true);
    try {
      console.group("[AdminShell] DIAGNOSTICS");
      console.debug("AuthContext:", auth);
      const stored = getAuthFromStorage();
      console.debug("getAuthFromStorage():", stored);
      console.debug("axios auth header (api.defaults):", api?.defaults?.headers?.common?.Authorization ?? "(not set)");
      console.debug("axios x-role header:", api?.defaults?.headers?.common?.["x-role"] ?? "(not set)");
      // raw fetch to backend (bypass interceptors) — shows status & a small body preview
      const testUrl = `${BASE_URL}/api/admin/theaters?_ts=${Date.now()}`;
      try {
        const raw = await fetch(testUrl, { method: "GET", mode: "cors", credentials: "include" });
        const txt = await raw.text();
        console.debug("raw fetch", testUrl, "status", raw.status, "bodyPreview:", txt.slice(0, 500));
        setLastDiag({ url: testUrl, status: raw.status, preview: txt.slice(0, 500) });
      } catch (e) {
        console.warn("raw fetch failed:", e?.message ?? e);
        setLastDiag({ url: testUrl, error: String(e) });
      }
      console.groupEnd();
    } catch (e) {
      console.error("runDiagnostics failed:", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6">
      {/* Optional debug bar — toggle with VITE_ADMIN_SHELL_DEBUG or DEV */}
      {DEBUG_ADMIN_SHELL && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Terminal className="h-4 w-4 text-slate-500" />
            <div>
              <div><strong>auth.token</strong>: {short(getAuthFromStorage().token)}</div>
              <div><strong>auth.role</strong>: {short(getAuthFromStorage().role ?? auth.role ?? auth.user?.role)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => api.setAuthToken(getAuthFromStorage().token)}
              className="px-3 py-1 rounded-full border text-sm bg-slate-50"
              title="Prime axios with token from storage"
            >
              Prime axios
            </button>

            <button
              onClick={runDiagnostics}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0071DC] text-white text-sm hover:bg-[#0654BA] disabled:opacity-60"
            >
              {busy ? "Running…" : "Run Diagnostics"}
            </button>
          </div>
        </div>
      )}

      <Outlet />

      {/* compact last-diagnostic preview (useful when debugging intermittency) */}
      {DEBUG_ADMIN_SHELL && lastDiag && (
        <div className="mt-4 text-xs text-slate-600 border rounded p-2 bg-slate-50">
          <div className="font-semibold">Last diagnostic</div>
          <div>Status: {lastDiag.status ?? "error"}</div>
          {lastDiag.preview ? (
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto">{lastDiag.preview}</pre>
          ) : (
            <div className="text-rose-600">Error: {lastDiag.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
