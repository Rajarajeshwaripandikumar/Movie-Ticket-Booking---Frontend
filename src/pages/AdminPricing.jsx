// src/pages/AdminPricing.jsx — Walmart Style (clean, rounded, blue accents)
import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { CalendarClock, CircleDollarSign, RefreshCcw } from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";

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
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[${BLUE}] hover:bg-[${BLUE_DARK}] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[${BLUE}] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Component -------------------------------- */
export default function AdminPricing() {
  const { token, role } = useAuth() || {};
  const [showtimes, setShowtimes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  useEffect(() => {
    if (token && role?.toLowerCase() === "admin") loadShowtimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  async function loadShowtimes() {
    try {
      const { data } = await api.get("/admin/showtimes");
      setShowtimes(data || []);
      if (data?.length) setSelectedId(data[0]._id);
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
    setLoading(true);
    setMsg("");

    try {
      await api.patch(`/admin/pricing/${selectedId}`, {
        basePrice: Number(basePrice),
      });

      setMsgType("success");
      setMsg("Pricing updated successfully!");
      setBasePrice("");
      await loadShowtimes();
    } catch (err) {
      console.error("updatePricing error:", err);
      setMsgType("error");
      setMsg(err?.response?.data?.message || "Failed to update pricing. Check console for details.");
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
            Adjust base ticket price for an existing showtime.
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
                      {(s.movie?.title || "Unknown Movie")} — {s.city} —{" "}
                      {new Date(s.startTime).toLocaleString("en-IN")} — ₹{s.basePrice}
                    </option>
                  ))}
                </Field>
                <SecondaryBtn type="button" onClick={loadShowtimes} aria-label="Refresh list">
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </SecondaryBtn>
              </div>
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
              <PrimaryBtn type="submit" disabled={loading} className="flex-1">
                {loading ? "Updating…" : "Update Pricing"}
              </PrimaryBtn>
              <SecondaryBtn
                type="button"
                onClick={() => {
                  setBasePrice("");
                  setSelectedId(showtimes?.[0]?._id || "");
                  setMsg("");
                }}
              >
                Reset
              </SecondaryBtn>
            </div>
          </form>
        </Card>

        {/* Inline tip */}
        
      </div>
    </main>
  );
}
