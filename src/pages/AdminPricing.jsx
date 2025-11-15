// src/pages/AdminPricing.jsx — Simplified: Pricing = showtime.basePrice
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { CalendarClock, CircleDollarSign, RefreshCcw } from "lucide-react";

/* --------------------------- UI Primitives --------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

function Field({ as = "input", className = "", ...props }) {
  const C = as;
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
    </div>
  );
}

function PrimaryBtn({ children, ...props }) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, ...props }) {
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

/* ------------------------------- Helpers ------------------------------ */
const fmtINR = (n) =>
  typeof n === "number"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
    : "";

const dateTime = (s) => {
  try {
    return new Date(s).toLocaleString("en-IN");
  } catch {
    return String(s || "");
  }
};

/* -------------------------------- Page -------------------------------- */
export default function AdminPricing() {
  const { token } = useAuth() || {};
  const [showtimes, setShowtimes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);

  const selectedShow = useMemo(() => showtimes.find((s) => s._id === selectedId), [showtimes, selectedId]);

  useEffect(() => {
    if (token) loadShowtimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadShowtimes() {
    setLoadingShowtimes(true);
    setMsg("");
    try {
      // Prefer admin endpoint; backend may return { data: [...] } or array
      const res = await api.get("/admin/showtimes");
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : data?.data ?? data?.showtimes ?? [];
      setShowtimes(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length) {
        const first = list[0];
        setSelectedId(first._id ?? first.id ?? "");
        setBasePrice(String(first?.basePrice ?? ""));
      } else {
        setSelectedId("");
        setBasePrice("");
      }
      setMsg("");
    } catch (err) {
      console.error("[AdminPricing] loadShowtimes failed:", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || "Failed to load showtimes.");
      setShowtimes([]);
      setSelectedId("");
      setBasePrice("");
    } finally {
      setLoadingShowtimes(false);
    }
  }

  async function updatePricing(e) {
    e.preventDefault();
    if (!selectedId) {
      setMsgType("error");
      setMsg("Please select a showtime.");
      return;
    }

    const price = Number(basePrice);
    if (Number.isNaN(price) || price < 1) {
      setMsgType("error");
      setMsg("Enter a valid price (>= 1).");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      await api.patch(`/admin/showtimes/${selectedId}`, { basePrice: price });
      setMsgType("success");
      setMsg("Pricing updated successfully!");
      await loadShowtimes(); // refresh dropdown values
    } catch (err) {
      console.error("[AdminPricing] updatePricing failed:", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || "Failed to update pricing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-2xl mx-auto space-y-4">

        <Card className="p-5 md:p-6">
          <h1 className="text-2xl md:text-3xl font-extrabold">Update Pricing</h1>
          <p className="text-sm text-slate-600 mt-1">
            Adjust the base ticket price for a showtime. This updates the showtime directly.
          </p>
        </Card>

        <Card className="p-5 md:p-6">
          <form onSubmit={updatePricing} className="space-y-4">
            {/* Showtime select */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Select Showtime</label>
              <div className="flex gap-2">
                <Field
                  as="select"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    const s = showtimes.find((x) => (x._id ?? x.id) === e.target.value);
                    setBasePrice(s?.basePrice ?? "");
                  }}
                >
                  <option value="">{loadingShowtimes ? "Loading showtimes…" : "-- Select --"}</option>
                  {showtimes.map((s) => (
                    <option key={s._id ?? s.id} value={s._id ?? s.id}>
                      {(s.movie?.title || s.movie?.name || "Untitled") + " — " + (s.city || s.location || "—") + " — " + dateTime(s.startTime) + " — " + fmtINR(Number(s.basePrice ?? 0))}
                    </option>
                  ))}
                </Field>

                <SecondaryBtn type="button" onClick={loadShowtimes} disabled={loadingShowtimes}>
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </SecondaryBtn>
              </div>

              {selectedShow && (
                <p className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> {selectedShow.movie?.title || "—"} • {dateTime(selectedShow.startTime)}
                </p>
              )}
            </div>

            {/* Base Price Input */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Base Price (₹)</label>
              <div className="flex gap-2 items-center">
                <span className="inline-grid place-items-center h-10 w-10 border border-slate-300 rounded-xl bg-slate-50">
                  <CircleDollarSign className="h-5 w-5 text-slate-700" />
                </span>
                <Field
                  type="number"
                  min={1}
                  step="1"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            </div>

            {/* Message */}
            {msg && (
              <Card className={`p-3 font-semibold ${msgType === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
                {msg}
              </Card>
            )}

            <div className="flex gap-2">
              <PrimaryBtn type="submit" disabled={loading || !selectedId} className="flex-1">
                {loading ? "Updating…" : "Save Pricing"}
              </PrimaryBtn>
              <SecondaryBtn
                type="button"
                onClick={() => setBasePrice(selectedShow?.basePrice ?? "")}
                disabled={!selectedShow}
              >
                Reset
              </SecondaryBtn>
            </div>
          </form>
        </Card>

      </div>
    </main>
  );
}
