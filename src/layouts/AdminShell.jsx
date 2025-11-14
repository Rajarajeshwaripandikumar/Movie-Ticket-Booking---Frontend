// src/layouts/AdminShell.jsx — Admin shell with optional diagnostics (improved)
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import api, { getAuthFromStorage, BASE_URL, apiUrl, COOKIE_AUTH } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { Terminal } from "lucide-react";

const DEBUG_ADMIN_SHELL =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env?.VITE_ADMIN_SHELL_DEBUG || import.meta.env?.DEV);

function short(s = "") {
  if (!s) return "(none)";
  const str = String(s);
  return str.length > 12 ? `${str.slice(0, 8)}…` : str;
}

/**
 * tryFetchPreview(url, opts)
 * - fetches and returns a small preview object with status and preview text
 * - attempts JSON->stringify if content-type is json, otherwise reads text
 */
async function tryFetchPreview(url, opts = {}) {
  try {
    const resp = await fetch(url, { method: "GET", mode: "cors", credentials: COOKIE_AUTH ? "include" : "same-origin", ...opts });
    const ct = resp.headers.get("content-type") || "";
    let preview = "";
    if (ct.includes("application/json")) {
      try {
        const json = await resp.json();
        preview = JSON.stringify(json, null, 2).slice(0, 1000);
      } catch {
        const txt = await resp.text();
        preview = txt.slice(0, 1000);
      }
    } else {
      const txt = await resp.text();
      preview = txt.slice(0, 1000);
    }
    return { url, status: resp.status, preview };
  } catch (e) {
    return { url, error: String(e) };
  }
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

      // Show axios defaults cleanly
      console.debug("axios auth header (api.defaults):", api?.defaults?.headers?.common?.Authorization ?? "(not set)");
      console.debug("axios x-role header:", api?.defaults?.headers?.common?.["x-role"] ?? api?.defaults?.headers?.common?.["X-Role"] ?? "(not set)");

      // Use apiUrl helper to build the test URL (avoids manual /api duplication)
      const testUrl = apiUrl("/admin/theaters");
      console.debug("diagnostic testUrl (via apiUrl):", testUrl);

      const result = await tryFetchPreview(`${testUrl}?_ts=${Date.now()}`);
      if (result.error) {
        console.warn("raw fetch failed:", result.error);
        setLastDiag({ url: result.url, error: result.error });
      } else {
        console.debug("raw fetch", result.url, "status", result.status, "preview:", result.preview);
        setLastDiag({ url: result.url, status: result.status, preview: result.preview });
      }
      console.groupEnd();
    } catch (e) {
      console.error("runDiagnostics failed:", e);
      setLastDiag({ error: String(e) });
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
          <div className="text-[12px]">URL: <code className="text-[11px]">{lastDiag.url}</code></div>
          <div className="text-[12px]">Status: {lastDiag.status ?? "error"}</div>
          {lastDiag.preview ? (
            <pre className="whitespace-pre-wrap max-h-40 overflow-auto text-[11px]">{lastDiag.preview}</pre>
          ) : (
            <div className="text-rose-600">Error: {lastDiag.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
