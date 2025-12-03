// src/pages/theatre/TheatrePricing.jsx — Theatre-scoped pricing manager (polished)
// - Defensive fetching / patch/put probing
// - Loading UX, optimistic update with rollback
// - Accessibility: aria-live, role=status
// - Input normalization and disabled states

import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

/* ------------------------------ helpers ------------------------------ */
const A = (x) =>
  Array.isArray(x)
    ? x
    : Array.isArray(x?.items)
    ? x.items
    : Array.isArray(x?.data)
    ? x.data
    : [];

const idOf = (x) => x?._id ?? x?.id ?? x?.uuid ?? "";
const titleOf = (x) => x?.title ?? x?.name ?? x?.movieTitle ?? "Untitled";
const whenOf = (s) => s?.startsAt || s?.startAt || s?.startTime || s?.time || s?.datetime;
const priceOf = (s) => {
  const v = s?.basePrice ?? s?.price ?? s?.amount ?? s?.cost ?? "";
  return v === "" ? "" : Number(v);
};

function decodeJwt(t) {
  try {
    if (!t) return {};
    const payload = String(t).split(".")[1];
    return payload ? JSON.parse(atob(payload)) : {};
  } catch {
    return {};
  }
}

/* try endpoints for GET */
async function tryGet(endpoints = []) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.get(ep);
      return r?.data ?? r;
    } catch {}
  }
  return undefined;
}

/* try patch then put (returns data or throws) */
async function tryPatchPut(endpoints = [], body = {}) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const res = await api.patch(ep, body);
      return res?.data ?? res;
    } catch {
      try {
        const res2 = await api.put(ep, body);
        return res2?.data ?? res2;
      } catch {}
    }
  }
  throw new Error("No compatible pricing endpoint");
}

/* ------------------------------ Component ------------------------------ */
export default function TheatrePricing() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null;

  const payload = decodeJwt(activeToken);

  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    user?.theatre?.id ||
    user?.theatre?._id ||
    user?.theater?.id ||
    user?.theater?._id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [showtimes, setShowtimes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [price, setPrice] = useState(200);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const selected = useMemo(
    () => showtimes.find((s) => (s._id || s.id) === selectedId) ?? null,
    [showtimes, selectedId]
  );

  useEffect(() => {
    document.title = "Update Pricing | Theatre";
  }, []);

  useEffect(() => {
    if (!isTheatreAdmin || !theatreId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setMsg("");
    (async () => {
      try {
        const ts = Date.now();
        const data =
          (await tryGet([
            `/theatre/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/admin/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/showtimes?theatre=${theatreId}&ts=${ts}`,
          ])) || [];

        if (!mounted) return;
        const items = A(data);
        setShowtimes(items);

        if (items.length) {
          const first = items[0];
          const id = idOf(first);
          setSelectedId(id);
          setPrice(Number(priceOf(first) || 200));
        } else {
          setSelectedId("");
          setPrice(200);
        }
      } catch (e) {
        if (!mounted) return;
        setMsgType("error");
        setMsg(e?.response?.data?.message || "Failed to load showtimes for pricing.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isTheatreAdmin, theatreId]);

  const onSelect = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const st = showtimes.find((x) => (x._id || x.id) === id);
    setPrice(Number(priceOf(st) || 200));
    setMsg("");
  };

  const save = useCallback(async () => {
    if (!selectedId) {
      setMsgType("error");
      setMsg("Select a showtime first.");
      return;
    }

    // normalize price
    const numericPrice = Number(String(price).replace(/[^\d.-]/g, "")) || 0;
    if (numericPrice < 0) {
      setMsgType("error");
      setMsg("Price must be 0 or greater.");
      return;
    }

    setMsg("");
    setMsgType("info");

    // optimistic update
    const prev = [...showtimes];
    setShowtimes((xs) =>
      xs.map((x) => ((x._id || x.id) === selectedId ? { ...x, basePrice: numericPrice, price: numericPrice } : x))
    );

    try {
      await tryPatchPut(
        [
          `/theatre/showtimes/${selectedId}/price`,
          `/theatre/showtimes/${selectedId}`,
          `/admin/showtimes/${selectedId}`,
          `/showtimes/${selectedId}`,
        ],
        { basePrice: numericPrice, price: numericPrice }
      );
      setMsgType("success");
      setMsg("Pricing updated.");
    } catch (e) {
      // rollback
      setShowtimes(prev);
      setMsgType("error");
      setMsg(e?.response?.data?.message || "Failed to save pricing.");
    }
  }, [selectedId, price, showtimes]);

  // Guards
  if (!activeToken) return <Navigate to="/admin/login" replace />;
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h1 className="text-xl font-bold text-[#0071DC]">Update Pricing</h1>

          <div role="status" aria-live="polite" className="mt-3">
            {msg && (
              <div
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  msgType === "error"
                    ? "bg-rose-50 border border-rose-200 text-rose-700"
                    : msgType === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-blue-50 border border-blue-200 text-blue-700"
                }`}
              >
                {msg}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="showtime-select" className="text-sm text-slate-600">Select showtime</label>
              <select
                id="showtime-select"
                className="w-full mt-1 border rounded-xl p-2"
                value={selectedId}
                onChange={onSelect}
                disabled={loading || showtimes.length === 0}
              >
                {loading ? (
                  <option>Loading…</option>
                ) : showtimes.length === 0 ? (
                  <option value="">No showtimes</option>
                ) : (
                  showtimes.map((s) => {
                    const id = idOf(s);
                    const label = `${titleOf(s.movie || { title: s.movieTitle })} — ${
                      whenOf(s) ? new Date(whenOf(s)).toLocaleString() : "—"
                    } — ₹${priceOf(s) || 200}`;
                    return (
                      <option key={id || Math.random()} value={id}>
                        {label}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div>
              <label htmlFor="price" className="text-sm text-slate-600">Base Price (₹)</label>
              <input
                id="price"
                type="number"
                min={0}
                step="1"
                className="w-full mt-1 border rounded-xl p-2"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!selectedId || loading}
                aria-label="Base price in rupees"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={save}
              disabled={!selectedId || loading}
              className="bg-[#0071DC] text-white rounded-xl px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Save Pricing"}
            </button>
          </div>
        </Card>

        {/* Quick table */}
        <Card>
          <h2 className="font-semibold mb-3 text-[#0071DC]">Showtimes</h2>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
            </div>
          ) : showtimes.length === 0 ? (
            <div className="text-sm text-slate-600">No showtimes found.</div>
          ) : (
            <div className="divide-y">
              {showtimes.map((s) => (
                <div key={idOf(s) || Math.random()} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{titleOf(s.movie || { title: s.movieTitle })}</div>
                    <div className="text-xs text-slate-600">
                      {whenOf(s) ? new Date(whenOf(s)).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">₹{priceOf(s) || 200}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
