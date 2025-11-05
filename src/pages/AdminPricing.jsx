// src/pages/AdminPricing.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { CalendarClock, CircleDollarSign, RefreshCcw } from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function Field({ as = "input", className = "", ...props }) {
  const C = as;
  return (
    <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
      <C {...props} className={`w-full outline-none bg-transparent text-sm sm:text-base ${className}`} />
    </div>
  );
}

function PrimaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Small utils ------------------------------ */
const fmtINR = (n) =>
  typeof n === "number" && !isNaN(n)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
    : "";

function dateTime(s) {
  try {
    return new Date(s).toLocaleString("en-IN");
  } catch {
    return s ?? "";
  }
}

/* ------------------------------ API helpers ------------------------------- */
/** Try multiple URL shapes for pricing-by-showtime */
async function getPricingByShowtime(showtimeId) {
  const urls = [
    `/admin/pricing/${showtimeId}`,          // path param style
    `/admin/pricing?showtimeId=${showtimeId}`// query style
  ];
  for (const u of urls) {
    try {
      const { data } = await api.get(u);
      if (data) return data;
    } catch (e) {
      if (e?.response?.status !== 404) throw e; // tolerate only 404
    }
  }
  return null;
}

/** Create default pricing for a given showtime */
async function createDefaultPricing(showtimeId, seed = {}) {
  const payload = {
    showtimeId,
    basePrice: 200,
    weekendMultiplier: 1.2,
    premiumSeatAddon: 80,
    taxPct: 18,
    feesPct: 5,
    currency: "INR",
    ...seed,
  };
  const { data } = await api.post(`/admin/pricing`, payload);
  return data;
}

/** Update pricing; if API uses showtimeId as identifier, PATCH it; fallback to POST-on-miss */
async function patchPricingForShowtime(showtimeId, patchBody) {
  try {
    const { data } = await api.patch(`/admin/pricing/${showtimeId}`, patchBody);
    return data;
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
    // Not found → create instead
    const created = await createDefaultPricing(showtimeId, patchBody);
    return created;
  }
}

/* -------------------------------- Component -------------------------------- */
export default function AdminPricing() {
  const { token } = useAuth() || {};
  const [showtimes, setShowtimes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentPricing, setCurrentPricing] = useState(null);

  const [basePrice, setBasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const selectedShow = useMemo(
    () => showtimes.find((s) => s._id === selectedId),
    [showtimes, selectedId]
  );

  useEffect(() => {
    // Route guards already enforce role; just ensure we have a token
    if (token) loadShowtimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setCurrentPricing(null);
      return;
    }
    // Load pricing for selected showtime; create defaults if absent
    (async () => {
      try {
        setMsg("");
        let pricing = await getPricingByShowtime(selectedId);
        if (!pricing) {
          pricing = await createDefaultPricing(selectedId);
        }
        setCurrentPricing(pricing);
        // Prefill editor with current basePrice
        if (typeof pricing?.basePrice === "number") {
          setBasePrice(String(pricing.basePrice));
        }
      } catch (err) {
        console.error("[AdminPricing] load pricing failed:", err);
        setMsgType("error");
        setMsg(err?.response?.data?.message || "Failed to load pricing for this showtime.");
      }
    })();
  }, [selectedId]);

  async function loadShowtimes() {
    try {
      const { data } = await api.get("/admin/showtimes");
      const list = Array.isArray(data) ? data : [];
      setShowtimes(list);
      // set default selection
      if (list.length) setSelectedId(list[0]._id);
      setMsg("");
    } catch (err) {
      console.error("loadShowtimes error:", err);
      setMsgType("error");
      setMsg("Failed to load showtimes.");
    }
  }

  async function updatePricing(e) {
    e.preventDefault();
    if (!selectedId) {
      setMsgType("error");
      setMsg("Please select a showtime first.");
      return;
    }
    const val = Number(basePrice);
    if (Number.isNaN(val) || val < 0) {
      setMsgType("error");
      setMsg("Enter a valid non-negative price.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const saved = await patchPricingForShowtime(selectedId, { basePrice: val });
      setCurrentPricing(saved);
      setMsgType("success");
      setMsg("Pricing saved.");
      // reflect new price in dropdown label if your backend hydrates basePrice on showtime
      await loadShowtimes();
    } catch (err) {
      console.error("updatePricing error:", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || "Failed to update pricing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900 py-8 px-4 md:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-5 md:p-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Update Pricing</h1>
          <p className="text-sm text-slate-600 mt-1">
            Adjust the base ticket price for a specific showtime. If pricing doesn’t exist yet, we’ll create it automatically.
          </p>
        </Card>

        {/* Form */}
        <Card className="p-5 md:p-6">
          <form onSubmit={updatePricing} className="space-y-4">
            {/* Showtime dropdown */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                Select Showtime
              </label>
              <div className="flex items-center gap-2">
                <Field
                  as="select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  required
                >
                  <option value="">-- Select showtime --</option>
                  {showtimes.map((s) => (
                    <option key={s._id} value={s._id}>
                      {(s.movie?.title || "Unknown Movie")} — {s.city || s.theatre?.city || "—"} —{" "}
                      {dateTime(s.startTime)} — {typeof s.basePrice === "number" ? fmtINR(s.basePrice) : ""}
                    </option>
                  ))}
                </Field>
                <SecondaryBtn type="button" onClick={loadShowtimes} aria-label="Refresh list">
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </SecondaryBtn>
              </div>
              {selectedShow && (
                <p className="mt-2 text-xs text-slate-600 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  <span>
                    {selectedShow.movie?.title || "Movie"} • {dateTime(selectedShow.startTime)}
                  </span>
                </p>
              )}
            </div>

            {/* Base price input */}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                New Base Price (₹)
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-grid place-items-center h-10 w-10 rounded-xl border border-slate-300 bg-slate-50">
                  <CircleDollarSign className="h-5 w-5 text-slate-700" />
                </span>
                <Field
                  type="number"
                  placeholder="e.g. 250"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                  min={0}
                  step="1"
                />
              </div>
              {!!currentPricing && (
                <p className="mt-2 text-xs text-slate-600">
                  Current saved price: {fmtINR(currentPricing.basePrice)}
                </p>
              )}
            </div>

            {/* Message banner */}
            {msg && (
              <Card
                className={`p-3 font-semibold ${
                  msgType === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : msgType === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {msg}
              </Card>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <PrimaryBtn type="submit" disabled={loading || !selectedId} className="flex-1">
                {loading ? "Updating…" : "Save Pricing"}
              </PrimaryBtn>
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setBasePrice(currentPricing?.basePrice != null ? String(currentPricing.basePrice) : "");
                  setMsg("");
                  setMsgType("info");
                }}
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
