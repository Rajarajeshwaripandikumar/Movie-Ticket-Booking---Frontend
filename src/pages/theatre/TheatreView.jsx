// src/pages/theatre/TheatreView.jsx — unified profile + seat picker (polished District / Walmart)
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate, Navigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";

/* --------------------------- UI primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

/* ------------------------------ helpers ------------------------------ */
const A = (x) =>
  Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : [];
const first = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : null);
const idOf = (x) => x?.id ?? x?._id ?? x?.uuid ?? "";
const titleOf = (x) => x?.title ?? x?.name ?? x?.movieTitle ?? "Untitled";

function decodeJwt(t) {
  try {
    if (!t) return {};
    const payload = String(t).split(".")[1];
    return payload ? JSON.parse(atob(payload)) : {};
  } catch {
    return {};
  }
}

async function getFirst(cands = []) {
  for (const ep of cands.filter(Boolean)) {
    try {
      const r = await api.get(ep);
      return r?.data ?? r;
    } catch (_) {
      // continue
    }
  }
  return undefined;
}

/* -------------------------------- Page -------------------------------- */
export default function TheatreView() {
  const { id: idFromParams } = useParams(); // optional /theatre/:id
  const navigate = useNavigate();
  const { token, adminToken, user, isTheatreAdmin } = useAuth() || {};

  // use active token (admin preferred)
  const activeToken = adminToken || token || null;
  const payload = decodeJwt(activeToken);

  // robust theatreId resolution: user → url → jwt
  const theatreId =
    user?.theatreId ||
    user?.theaterId ||
    idFromParams ||
    user?.theatre?._id ||
    user?.theatre?.id ||
    user?.theater?._id ||
    user?.theater?.id ||
    payload?.theatreId ||
    payload?.theaterId ||
    "";

  const [theatre, setTheatre] = useState(null);
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [seatLayout, setSeatLayout] = useState({ rows: 8, cols: 12, booked: [] });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Theatre Profile | Cinema";
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSeatLayout = useCallback(
    async (tid, showId, showObj) => {
      if (!mountedRef.current) return;
      setSelectedSeats(new Set());

      // prefer inline layout on show
      const inline =
        showObj?.layout ||
        showObj?.seatLayout ||
        (showObj?.screen && {
          rows: showObj.screen.rows ?? showObj.screen.seatRows,
          cols: showObj.screen.cols ?? showObj.screen.columns ?? showObj.screen.seatCols,
          booked: showObj.bookedSeats || showObj.booked || [],
        });

      if (inline && inline.rows && inline.cols) {
        if (!mountedRef.current) return;
        setSeatLayout({
          rows: Number(inline.rows) || 8,
          cols: Number(inline.cols) || 12,
          booked: (inline.booked || []).map(String),
        });
        return;
      }

      try {
        const data =
          (await getFirst([
            `/showtimes/${showId}/seats`,
            `/admin/showtimes/${showId}/seats`,
            `/theatre/showtimes/${showId}/seats`,
          ])) || {};

        const rows = data.rows ?? data.seatRows ?? data.layout?.rows ?? data.screen?.rows ?? 8;
        const cols = data.cols ?? data.columns ?? data.seatCols ?? data.layout?.cols ?? data.screen?.cols ?? 12;
        const booked = data.booked ?? data.bookedSeats ?? data.layout?.booked ?? [];

        if (!mountedRef.current) return;
        setSeatLayout({
          rows: Number(rows) || 8,
          cols: Number(cols) || 12,
          booked: (booked || []).map(String),
        });
      } catch (e) {
        // fallback defaults
        if (!mountedRef.current) return;
        setSeatLayout({ rows: 8, cols: 12, booked: [] });
      }
    },
    []
  );

  useEffect(() => {
    if (!theatreId) {
      setErr("Theatre not found.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr("");
      try {
        // theatre details
        const tData =
          (await getFirst([
            `/theatre/my`,
            `/theatre/me`,
            `/theaters/${theatreId}`,
            `/admin/theaters/${theatreId}`,
          ])) || {};

        const t = first(tData.theatre) || first(tData.theater) || first(tData.data) || first(tData) || null;
        if (!mountedRef.current) return;
        setTheatre(t);

        // showtimes (upcoming)
        const stData =
          (await getFirst([
            `/theatre/showtimes?theatre=${theatreId}&upcoming=true`,
            `/admin/showtimes?theatre=${theatreId}&upcoming=true`,
            `/showtimes?theatre=${theatreId}&upcoming=true`,
          ])) || [];

        const list = A(stData);
        if (!mountedRef.current) return;
        setShows(list);

        if (list.length) {
          const def = list[0];
          setSelectedShow(def);
          await loadSeatLayout(theatreId, idOf(def), def);
        } else {
          setSelectedShow(null);
          setSeatLayout({ rows: 8, cols: 12, booked: [] });
        }
      } catch (e) {
        if (!mountedRef.current) return;
        console.error("TheatreView load error", e?.response || e);
        setErr(e?.response?.data?.message || "Failed to load theatre.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theatreId, loadSeatLayout]);

  function toggleSeat(seatId) {
    const bookedSet = new Set((seatLayout.booked || []).map(String));
    if (bookedSet.has(String(seatId))) return;
    setSelectedSeats((prev) => {
      const out = new Set(prev);
      if (out.has(seatId)) out.delete(seatId);
      else out.add(seatId);
      return out;
    });
  }

  function seatsToQuery() {
    return encodeURIComponent(Array.from(selectedSeats).join(","));
  }

  function goToBooking() {
    if (!selectedShow || selectedSeats.size === 0) return;
    const sid = idOf(selectedShow);
    navigate(`/seats/${sid}?seats=${seatsToQuery()}`);
  }

  /* Derived seat grid (memoized) */
  const grid = useMemo(() => {
    const rows = Number(seatLayout.rows) || 8;
    const cols = Number(seatLayout.cols) || 12;
    const booked = new Set((seatLayout.booked || []).map(String));
    const out = [];
    for (let r = 0; r < rows; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      const seats = [];
      for (let c = 1; c <= cols; c++) {
        const id = `${rowLetter}${c}`;
        seats.push({ id, booked: booked.has(id) });
      }
      out.push({ row: rowLetter, seats });
    }
    return out;
  }, [seatLayout]);

  // derived labels for selected show (safer date handling)
  const selectedShowTimeRaw =
    selectedShow?.startTime ||
    selectedShow?.startAt ||
    selectedShow?.time ||
    selectedShow?.datetime ||
    "";
  let selectedShowTimeLabel = "";
  if (selectedShowTimeRaw) {
    const d = new Date(selectedShowTimeRaw);
    if (!isNaN(d)) selectedShowTimeLabel = d.toLocaleString();
  }

  /* Guard: if theatre admin viewing admin area and not logged in -> redirect */
  if (!activeToken && isTheatreAdmin) return <Navigate to="/admin/login" replace />;

  /* Render */
  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="animate-pulse h-44 bg-gray-200 rounded mb-4" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-semibold text-rose-600">Failed to load theatre</h2>
          <p className="mt-2 text-sm text-slate-700">{err}</p>
          <div className="mt-4">
            <Link to="/" className="px-4 py-2 rounded-full bg-[#0071DC] text-white hover:bg-[#0654BA]">
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedPrice = Number(selectedShow?.basePrice ?? selectedShow?.price ?? 0);
  const subtotal = selectedPrice * selectedSeats.size;

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Left: info + showtimes + seatmap */}
        <Card className="md:col-span-2 p-6">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-[#111827]">{theatre?.name || "Theatre"}</h1>
              <p className="text-sm text-slate-600 mt-1">{theatre?.address || theatre?.city || "—"}</p>
              {theatre?.description && <p className="text-sm text-slate-500 mt-2">{theatre.description}</p>}

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700">Showtimes</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {shows.length ? (
                    shows.map((show) => {
                      const sid = idOf(show);
                      const active = idOf(selectedShow) === sid;
                      const whenRaw =
                        show.startTime || show.startAt || show.time || show.datetime || "";
                      let whenLabel = "";
                      if (whenRaw) {
                        const d = new Date(whenRaw);
                        if (!isNaN(d)) whenLabel = d.toLocaleString();
                      }
                      const price = show.basePrice ?? show.price ?? show.amount ?? "";

                      return (
                        <button
                          key={sid}
                          onClick={async () => {
                            setSelectedShow(show);
                            await loadSeatLayout(theatreId, sid, show);
                          }}
                          className={`px-3 py-2 rounded-full border focus:outline-none focus:ring-2 ${
                            active ? "bg-[#0071DC] text-white border-[#0071DC]" : "bg-white hover:bg-slate-50"
                          }`}
                          aria-pressed={active}
                        >
                          <div className="text-sm font-semibold">{titleOf(show.movie || {})}</div>
                          <div className="text-[11px] text-slate-600">
                            {whenLabel || "—"} {price ? ` · ₹${price}` : ""}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-600">No upcoming showtimes</div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-44 text-right">
              <div className="text-[11px] text-slate-500">Contact</div>
              <div className="text-sm font-medium mt-1">{theatre?.phone || "—"}</div>
              {Array.isArray(theatre?.amenities) && theatre.amenities.length > 0 && (
                <>
                  <div className="text-[11px] text-slate-400 mt-4">Amenities</div>
                  <ul className="text-[12px] mt-2 space-y-1 text-slate-700">
                    {theatre.amenities.slice(0, 6).map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Seat map */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700">
              Seat map — {selectedShow ? `${titleOf(selectedShow.movie || {})}` : "Select a showtime"}
            </h3>

            <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200" role="region" aria-live="polite">
              <div className="max-w-full overflow-auto">
                <div className="flex justify-center mb-4">
                  <div className="bg-black h-2 rounded w-2/3" />
                </div>

                <div className="space-y-2">
                  {grid.map((row) => (
                    <div key={row.row} className="flex items-center gap-3">
                      <div className="w-6 text-xs text-slate-600" aria-hidden>
                        {row.row}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {row.seats.map((seat) => {
                          const selected = selectedSeats.has(seat.id);
                          const booked = seat.booked;
                          return (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat.id)}
                              disabled={booked || !selectedShow}
                              aria-label={`Seat ${seat.id}${booked ? " (booked)" : selected ? " (selected)" : ""}`}
                              className={`w-9 h-9 rounded-md text-xs flex items-center justify-center border focus:outline-none focus:ring-2 ${
                                booked
                                  ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                                  : selected
                                  ? "bg-[#FFC220] text-black"
                                  : "bg-white hover:bg-slate-100"
                              }`}
                            >
                              {seat.id}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white border" /> Available
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-300" /> Booked
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ background: "#FFC220" }} /> Selected
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: booking summary */}
        <aside className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
          <div>
            <div className="text-[11px] text-slate-500">Now showing</div>
            <div className="text-lg font-semibold mt-1">
              {selectedShow ? titleOf(selectedShow.movie || {}) : "—"}
            </div>
            <div className="text-sm text-slate-600">
              {selectedShow && (
                <>
                  {selectedShowTimeLabel}
                  {(selectedShow.basePrice || selectedShow.price) && (
                    <> · ₹{selectedShow.basePrice ?? selectedShow.price}</>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <div className="text-[11px] text-slate-500">Selected seats</div>
            <div className="mt-2 text-sm font-semibold">{Array.from(selectedSeats).join(", ") || "None"}</div>
            <div className="mt-3 text-sm text-slate-700">
              Subtotal: <span className="font-bold">₹{subtotal}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Price per seat: ₹{selectedPrice}</div>
          </div>

          <button
            onClick={goToBooking}
            disabled={!selectedShow || selectedSeats.size === 0}
            className={`mt-auto px-4 py-3 rounded-2xl text-white font-semibold ${
              !selectedShow || selectedSeats.size === 0
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-[#0071DC] hover:bg-[#0654BA]"
            }`}
            aria-disabled={!selectedShow || selectedSeats.size === 0}
          >
            {selectedSeats.size ? `Book · ${selectedSeats.size} seat${selectedSeats.size > 1 ? "s" : ""}` : "Book"}
          </button>

          <Link to="/" className="text-center text-sm text-slate-500">
            Back to home
          </Link>
        </aside>
      </div>
    </main>
  );
}
