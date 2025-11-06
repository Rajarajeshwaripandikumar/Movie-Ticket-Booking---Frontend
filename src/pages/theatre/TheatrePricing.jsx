// src/pages/theatre/TheatrePricing.jsx — Theatre-scoped pricing manager
import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-4 ${className}`}>{children}</div>
);

/* ------------------------------ helpers ------------------------------ */
const A = (x) =>
  Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : [];

const idOf = (x) => x?._id ?? x?.id ?? x?.uuid ?? "";
const titleOf = (x) => x?.title ?? x?.name ?? x?.movieTitle ?? "Untitled";
const whenOf = (s) => s?.startsAt || s?.startAt || s?.startTime || s?.time || s?.datetime;
const priceOf = (s) => s?.basePrice ?? s?.price ?? s?.amount ?? "";

function decodeJwt(t) {
  try {
    return JSON.parse(atob(String(t ?? "").split(".")[1])) || {};
  } catch {
    return {};
  }
}

async function tryGet(endpoints) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      const r = await api.get(ep);
      return r?.data ?? r;
    } catch {}
  }
  return undefined;
}

async function tryPatchPut(endpoints, body) {
  for (const ep of endpoints.filter(Boolean)) {
    try {
      return (await api.patch(ep, body))?.data;
    } catch {
      try {
        return (await api.put(ep, body))?.data;
      } catch {}
    }
  }
  throw new Error("No compatible pricing endpoint");
}

export default function TheatrePricing() {
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};
  const activeToken = adminToken || token || null;                // ✅ use correct token

  const payload = decodeJwt(activeToken);

  // ✅ Unified theatreId resolution (same logic as TheatreDashboard)
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
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(true);

  const selected = useMemo(
    () => showtimes.find((s) => (s._id || s.id) === selectedId),
    [showtimes, selectedId]
  );

  useEffect(() => {
    document.title = "Update Pricing | Theatre";
  }, []);

  useEffect(() => {
    if (!isTheatreAdmin || !theatreId) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const ts = Date.now();

        const stData =
          (await tryGet([
            `/theatre/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/admin/showtimes?theatre=${theatreId}&ts=${ts}`,
            `/showtimes?theatre=${theatreId}&ts=${ts}`,
          ])) || [];

        if (!mounted) return;

        const items = A(stData);
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
  };

  const save = async () => {
    if (!selectedId) return;
    setMsg("");
    setMsgType("info");

    const prev = [...showtimes];

    setShowtimes((xs) =>
      xs.map((x) => ((x._id || x.id) === selectedId ? { ...x, basePrice: Number(price) } : x))
    );

    try {
      await tryPatchPut(
        [
          `/theatre/showtimes/${selectedId}/price`,
          `/theatre/showtimes/${selectedId}`,
          `/admin/showtimes/${selectedId}`,
          `/showtimes/${selectedId}`,
        ],
        { basePrice: Number(price), price: Number(price) }
      );
      setMsgType("success");
      setMsg("Pricing updated.");
    } catch (e) {
      setShowtimes(prev);
      setMsgType("error");
      setMsg(e?.response?.data?.message || "Failed to save pricing.");
    }
  };

  // ✅ Correct login guard
  if (!activeToken) return <Navigate to="/admin/login" replace />;

  // ✅ Correct role guard
  if (!isTheatreAdmin) {
    return <div className="p-8 text-center text-rose-600 font-semibold">Access Denied</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-5">
        <Card>
          <h1 className="text-xl font-bold text-[#0071DC]">Update Pricing</h1>

          {msg && (
            <div
              className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
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

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm text-slate-600">Select showtime</label>
              <select
                className="w-full mt-1 border rounded-xl p-2"
                value={selectedId}
                onChange={onSelect}
                disabled={loading || showtimes.length === 0}
              >
                {showtimes.length === 0 ? (
                  <option value="">No showtimes</option>
                ) : (
                  showtimes.map((s) => {
                    const id = idOf(s);
                    const label = `${titleOf(s.movie || { title: s.movieTitle })} — ${new Date(
                      whenOf(s)
                    ).toLocaleString()} — ₹${priceOf(s) || 200}`;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-600">Base Price (₹)</label>
              <input
                type="number"
                min={0}
                className="w-full mt-1 border rounded-xl p-2"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!selectedId}
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={save}
              disabled={!selectedId}
              className="bg-[#0071DC] text-white rounded-xl px-4 py-2 disabled:opacity-50"
            >
              Save Pricing
            </button>
          </div>
        </Card>

        {/* Quick table */}
        <Card>
          <h2 className="font-semibold mb-3">Showtimes</h2>
          {loading ? (
            <div>Loading…</div>
          ) : showtimes.length === 0 ? (
            <div className="text-sm text-slate-600">No showtimes found.</div>
          ) : (
            <div className="divide-y">
              {showtimes.map((s) => (
                <div key={idOf(s)} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {titleOf(s.movie || { title: s.movieTitle })}
                    </div>
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
