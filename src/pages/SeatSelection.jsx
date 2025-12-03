// src/pages/SeatSelection.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import Loader from "../components/Loader";

/* ---------------- theme ---------------- */
const BLUE = "#0071DC";
const BLUE_DARK = "#0654BA";

/* ---------------- primitives ---------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

function PrimaryBtn({ children, className = "", disabled, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-white 
        ${
          disabled
            ? "bg-slate-300 cursor-not-allowed"
            : "bg-[#0071DC] hover:bg-[#0654BA] focus-visible:ring-2 focus-visible:ring-[#0071DC]"
        } 
        ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const GhostPill = ({ children }) => (
  <span className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-800">
    {children}
  </span>
);

/* ---------------- helpers ---------------- */
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

const normalizeScreen = (s) => {
  if (!s) return null;
  return {
    _id: s._id,
    name: s.name || "Screen",
    rows: n(s.rows),
    cols: n(s.columns ?? s.cols),
  };
};

const seatKey = (r, c) => `${r}:${c}`;

/* Build full seat grid from screen size + snapshot overlay (normalize HELD→LOCKED) */
function buildGrid(rows, cols, snapshotList) {
  const map = new Map();
  for (const s of snapshotList) {
    const r = Number(s.row);
    const c = Number(s.col);
    if (Number.isFinite(r) && Number.isFinite(c)) {
      const raw = (s.status || "AVAILABLE").toUpperCase();
      const norm = raw === "HELD" ? "LOCKED" : raw; // normalize transient holds to LOCKED
      map.set(seatKey(r, c), norm);
    }
  }
  const out = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const k = seatKey(r, c);
      out.push({ row: r, col: c, status: map.get(k) || "AVAILABLE" });
    }
  }
  return out;
}

/* Single-letter row label: A, B, C... */
const rowLabel = (r) => String.fromCharCode(64 + r);

/* Circular seat button (Walmart look) */
function SeatButton({ state, number, active, onClick }) {
  const stateU = (state || "AVAILABLE").toUpperCase();
  const disabled =
    stateU === "BOOKED" || stateU === "LOCKED" || stateU === "HELD";
  const base =
    "w-7 h-7 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all select-none border";
  const classes = active
    ? "text-white border-transparent shadow-sm"
    : disabled
    ? "bg-white text-slate-400 border-slate-300"
    : "bg-white text-slate-800 border-slate-300 hover:border-[#0071DC] hover:shadow-sm";
  const style = active ? { background: BLUE } : undefined;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${classes} disabled:cursor-not-allowed`}
      style={style}
      aria-label={`Seat ${number} ${stateU}`}
      title={`Seat ${number} ${stateU}`}
    >
      {disabled ? "×" : number}
    </button>
  );
}

/* Row with center aisle gap */
function SeatRow({ rowIndex, seatsInRow, selected, onToggle }) {
  const lbl = rowLabel(rowIndex);
  const aisleAfter = Math.floor(seatsInRow.length / 2); // insert gap after middle seat

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-6 shrink-0 text-sm text-slate-700 font-semibold text-left">
        {lbl}
      </div>

      {/* Seat container */}
      <div
        className="inline-grid"
        style={{
          gridAutoFlow: "column",
          gridAutoColumns: "min-content",
          gap: "6px 6px",
        }}
      >
        {seatsInRow.map((s) => {
          const isActive = selected.some(
            (x) => x.row === s.row && x.col === s.col
          );
          return (
            <React.Fragment key={`${s.row}-${s.col}`}>
              <SeatButton
                number={s.col}
                state={s.status}
                active={isActive}
                onClick={() => onToggle({ row: s.row, col: s.col })}
              />
              {s.col === aisleAfter && <div style={{ width: 10 }} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function SeatSelection() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();

  const [showtime, setShowtime] = useState(null);
  const [screenSpec, setScreenSpec] = useState({
    _id: "",
    name: "Screen",
    rows: 10,
    cols: 10,
  });
  const [snapshotSeats, setSnapshotSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Lock tracking
  const [lockExpiresAt, setLockExpiresAt] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Prevent overlapping requests per seat
  const pending = useRef(new Set());

  const rowsToUse = screenSpec?.rows || 10;
  const colsToUse = screenSpec?.cols || 10;

  const seats = useMemo(
    () => buildGrid(rowsToUse, colsToUse, snapshotSeats),
    [rowsToUse, colsToUse, snapshotSeats]
  );

  /* ---------------- Fetch showtime ---------------- */
  const fetchShowtime = useCallback(async () => {
    try {
      setMsg("");
      setLoading(true);

      const { data } = await api.get(
        `/showtimes/${showtimeId}?ts=${Date.now()}`
      );
      const st = data?.data || data;
      setShowtime(st);

      const raw = st?.seats || [];
      const flat = (Array.isArray(raw[0]) ? raw.flat() : raw).map((s) => ({
        row: Number(s.row),
        col: Number(s.col),
        status: (s.status || "AVAILABLE").toUpperCase(),
      }));
      setSnapshotSeats(flat);

      const popScreen = normalizeScreen(
        typeof st?.screen === "object" ? st.screen : null
      );
      if (popScreen?.rows && popScreen?.cols) {
        setScreenSpec({
          _id: popScreen._id || "",
          name: popScreen.name || "Screen",
          rows: popScreen.rows,
          cols: popScreen.cols,
        });
      }
    } catch (e) {
      console.error("❌ Failed to load showtime", e);
      setMsg("⚠️ Failed to load showtime details.");
    } finally {
      setLoading(false);
    }
  }, [showtimeId]);

  useEffect(() => {
    fetchShowtime();
  }, [fetchShowtime]);

  // Poll to keep grid fresh
  useEffect(() => {
    const t = setInterval(fetchShowtime, 5000);
    return () => clearInterval(t);
  }, [fetchShowtime]);

  /* ---------------- Auth helper ---------------- */
  const ensureAuthed = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMsg("🔒 Please log in to reserve seats.");
      navigate("/login", { state: { redirectTo: `/seats/${showtimeId}` } });
      return false;
    }
    return true;
  };

  /* ---------------- Toggle seat (optimistic + rollback on 409) ---------------- */
  const toggleSeat = async (seat) => {
    setMsg("");
    const key = seatKey(seat.row, seat.col);

    // prevent spamming the same seat
    if (pending.current.has(key)) return;
    pending.current.add(key);

    const sInGrid = seats.find(
      (s) => s.row === seat.row && s.col === seat.col
    );
    if (!sInGrid) {
      pending.current.delete(key);
      return;
    }

    const sStatus = (sInGrid.status || "AVAILABLE").toUpperCase();
    if (sStatus === "BOOKED" || sStatus === "LOCKED" || sStatus === "HELD") {
      pending.current.delete(key);
      return;
    }

    const alreadySelected = selected.some(
      (s) => s.row === seat.row && s.col === seat.col
    );

    try {
      if (!ensureAuthed()) {
        pending.current.delete(key);
        return;
      }

      if (alreadySelected) {
        // optimistic remove
        setSelected((prev) =>
          prev.filter((s) => !(s.row === seat.row && s.col === seat.col))
        );
        try {
          await api.post("/bookings/release", {
            showtimeId,
            seats: [{ row: seat.row, col: seat.col }],
          });
        } catch (err) {
          // rollback on error
          setSelected((prev) => [...prev, seat]);
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            setMsg("🔒 Please log in to reserve seats.");
            navigate("/login", {
              state: { redirectTo: `/seats/${showtimeId}` },
            });
          } else {
            setMsg("Couldn’t release that seat. Try again.");
          }
        } finally {
          fetchShowtime();
        }
      } else {
        // optimistic add
        setSelected((prev) => [...prev, seat]);

        try {
          const { data } = await api.post("/bookings/lock", {
            showtimeId,
            seats: [{ row: seat.row, col: seat.col }],
          });

          if (data?.lockedUntil) {
            const newExpiry = new Date(data.lockedUntil);
            // if you want "all seats share one hold", we can just take the latest expiry
            setLockExpiresAt((prev) =>
              !prev || newExpiry > prev ? newExpiry : prev
            );
          }
          if (data?.serverTime) {
            const serverNow = new Date(data.serverTime).getTime();
            const clientNow = Date.now();
            setServerOffsetMs(clientNow - serverNow);
          }
        } catch (err) {
          // rollback on failure (e.g., 409 Conflict)
          setSelected((prev) =>
            prev.filter((s) => !(s.row === seat.row && s.col === seat.col))
          );

          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            setMsg("🔒 Please log in to reserve seats.");
            navigate("/login", {
              state: { redirectTo: `/seats/${showtimeId}` },
            });
          } else if (status === 409) {
            setMsg("⚠️ That seat was just taken. Pick another one.");
          } else {
            setMsg("Seat operation failed. Try again.");
          }

          // pull latest grid so the seat shows as taken
          fetchShowtime();
        }
      }
    } finally {
      pending.current.delete(key);
    }
  };

  /* ---------------- Lock countdown ---------------- */
  const [, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!lockExpiresAt) return null;
    const serverNowApprox = new Date(Date.now() - serverOffsetMs);
    return Math.max(
      0,
      Math.floor((lockExpiresAt - serverNowApprox) / 1000)
    );
  }, [lockExpiresAt, serverOffsetMs]);

  const lockExpired = secondsLeft !== null && secondsLeft <= 0;
  useEffect(() => {
    if (lockExpired && selected.length) {
      setMsg("⏳ Seat hold expired. Please reselect.");
      setSelected([]);
      setLockExpiresAt(null);
    }
  }, [lockExpired, selected.length]);

  /* ---------------- Rows ---------------- */
  const rowsArray = useMemo(() => {
    const rows = [];
    for (let r = 1; r <= rowsToUse; r++) {
      rows.push(
        seats
          .filter((s) => s.row === r)
          .sort((a, b) => a.col - b.col)
      );
    }
    return rows;
  }, [seats, rowsToUse]);

  /* ---------------- Checkout ---------------- */
  const proceedToCheckout = () => {
    if (!selected.length) return setMsg("Please select at least one seat.");
    if (!ensureAuthed()) return;
    if (!lockExpiresAt || lockExpired)
      return setMsg("⏳ Your seat hold expired. Please reselect.");

    const checkoutData = {
      showtimeId,
      seats: selected.map((s) => ({ row: s.row, col: s.col })),
      amount: selected.length * (showtime?.basePrice || 0),
      basePrice: showtime?.basePrice || 0,
    };
    localStorage.setItem("checkoutData", JSON.stringify(checkoutData));
    navigate(`/checkout/${showtimeId}`, { state: checkoutData });
  };

  /* ---------------- Render ---------------- */
  if (loading && !showtime) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Card className="max-w-5xl mx-auto p-6 md:p-7">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {showtime?.movie?.title || "Movie"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {(screenSpec.name || showtime?.screen?.name || "Screen")} •{" "}
            {showtime?.city} •{" "}
            {new Date(
              showtime?.startTime || showtime?.startAt
            ).toLocaleString("en-IN")}
          </p>

          {/* Time chip */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <GhostPill>
              {new Date(
                showtime?.startTime || showtime?.startAt
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </GhostPill>
          </div>

          {/* Price + hold */}
          <div className="mt-3">
            <span className="font-semibold text-[#0071DC]">
              BUDGET • ₹{(showtime?.basePrice ?? 0).toFixed(2)}
            </span>
            {lockExpiresAt && !lockExpired && (
              <span className="ml-3 text-sm text-amber-700">
                Hold expires in <b>{secondsLeft}s</b>
              </span>
            )}
            {lockExpired && (
              <span className="ml-3 text-sm text-rose-700">
                Seat hold expired.
              </span>
            )}
          </div>
        </div>

        {msg && (
          <Card
            className={`mb-4 p-3 text-sm font-medium ${
              msg.includes("✅")
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : msg.includes("⚠️") || msg.includes("⏳")
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {msg}
          </Card>
        )}

        {/* Seat card */}
        <Card className="border-none p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-800">
              BUDGET : ₹{(showtime?.basePrice ?? 0).toFixed(2)}
            </p>
          </div>

          <div className="px-5 py-5">
            {/* Screen on top */}
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-2">
                <svg
                  viewBox="0 0 460 70"
                  className="block w-[360px] sm:w-[420px] md:w-[460px] h-[70px] origin-center"
                  aria-hidden="true"
                >
                  <defs>
                    <filter
                      id="soft-blur"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="1.2"
                      />
                    </filter>
                  </defs>

                  {/* bottom glow */}
                  <path
                    d="M20,44 C120,14 340,14 440,44"
                    stroke="#8AB9FF"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.9"
                    filter="url(#soft-blur)"
                  />
                  {/* main curve */}
                  <path
                    d="M25,38 C125,8 335,8 435,38"
                    stroke={BLUE}
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                  {/* top highlight */}
                  <path
                    d="M35,32 C135,2 325,2 425,32"
                    stroke={BLUE_DARK}
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </svg>
              </div>
              <p className="text-center text-[11px] tracking-[0.2em] text-slate-500">
                SCREEN THIS WAY
              </p>
            </div>

            {/* Seat grid */}
            <div className="max-h-[52vh] overflow-auto">
              <div className="flex flex-col items-center gap-2 px-2">
                {rowsArray.map((rowSeats, idx) => (
                  <SeatRow
                    key={`r-${idx + 1}`}
                    rowIndex={idx + 1}
                    seatsInRow={rowSeats}
                    selected={selected}
                    onToggle={toggleSeat}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-slate-400 inline-block" />
                <span className="text-slate-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-slate-300 grid place-items-center text-[10px] text-slate-400">
                  ×
                </span>
                <span className="text-slate-600">Booked / Locked</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full inline-block"
                  style={{ background: BLUE }}
                />
                <span className="text-slate-600">Selected</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary + CTA */}
        <div className="mt-8">
          <p className="font-medium mb-1 text-center">
            Selected Seats:{" "}
            {selected.length
              ? selected
                  .map((s) => `[${rowLabel(s.row)}${s.col}]`)
                  .join(", ")
              : "None"}
          </p>
          <p className="text-lg font-semibold mb-4 text-center text-[#0071DC]">
            Total: ₹{selected.length * (showtime?.basePrice || 0)}
          </p>

          <PrimaryBtn
            onClick={proceedToCheckout}
            disabled={loading || !selected.length || !lockExpiresAt || lockExpired}
          >
            {loading
              ? "Processing…"
              : lockExpired
              ? "Hold Expired"
              : "Proceed to Payment"}
          </PrimaryBtn>
        </div>
      </Card>
    </div>
  );
}
