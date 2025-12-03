// src/pages/Showtimes.jsx — Walmart Style (clean, rounded, blue accents)
// Full updated file with:
// - memoized grouping (useMemo)
// - sold-out slots rendered as non-interactive blocks (no Link)
// - poster URL fallback robustness
// - small accessibility and minor UX fixes
// - PrimaryBtn now supports `as={Link}` so list-view "Select Seats" works

import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import api from "../api/api";
import useNotifications from "../hooks/useNotifications";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const Chip = ({ children, className = "" }) => (
  <span
    className={`inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 ${className}`}
  >
    {children}
  </span>
);

// 🔧 make PrimaryBtn polymorphic so `as={Link}` works
const PrimaryBtn = ({
  children,
  className = "",
  as: Tag = "button",
  ...props
}) => (
  <Tag
    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </Tag>
);

const GhostBtn = ({ children, className = "", ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ------------------------------ Date helpers ------------------------------ */
const pad = (n) => (n < 10 ? `0${n}` : String(n));
const toYmdLocal = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const fromYmdLocal = (ymd) => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date(ymd);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const clampToToday = (ymd) => {
  const today = toYmdLocal(new Date());
  return !ymd || ymd < today ? today : ymd;
};
const fmtDayShort = (d) =>
  d.toLocaleDateString(undefined, { weekday: "short" });
const fmtMonthDay = (d) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ------------------------------ Media helpers ------------------------------ */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";
const FILES_BASE = API_BASE.replace(/\/api\/?$/, "") || ""; // be defensive
const resolvePosterUrl = (url) => {
  if (!url) return null;
  try {
    return /^https?:\/\//i.test(url) ? url : `${FILES_BASE}${url}`;
  } catch {
    return null;
  }
};
const DEFAULT_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='120' height='170'>
      <rect width='100%' height='100%' fill='#f1f5f9'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='14' fill='#94a3b8'>No Image</text>
    </svg>
  `);

/* ------------------------------ Small UI bits ------------------------------ */
function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-300 bg-white p-1">
      {["calendar", "list"].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            view === v ? "bg-[#E6F0FE] text-[#0654BA]" : "hover:bg-slate-50"
          }`}
          aria-pressed={view === v}
        >
          {v === "calendar" ? "Calendar" : "List"}
        </button>
      ))}
    </div>
  );
}

function CalendarStrip({
  startDate,
  days,
  selectedDate,
  onSelect,
  availabilitySet,
}) {
  const dates = useMemo(() => {
    const base = new Date(startDate);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [startDate, days]);

  const todayYmd = toYmdLocal(new Date());

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-extrabold">Select a date</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {dates.map((d) => {
          const ymd = toYmdLocal(d);
          const isSelected = ymd === selectedDate;
          const isToday = ymd === todayYmd;
          const hasShows = availabilitySet ? availabilitySet.has(ymd) : true;
          const disabled = !hasShows;
          return (
            <button
              key={ymd}
              onClick={() => !disabled && onSelect(ymd)}
              disabled={disabled}
              className={`flex-none w-16 text-center rounded-xl border border-slate-300 px-2 py-2 font-semibold transition-colors ${
                isSelected
                  ? "bg-[#E6F0FE] text-[#0654BA]"
                  : "bg-white hover:bg-slate-50"
              } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              aria-pressed={isSelected}
              aria-label={`${fmtDayShort(d)} ${fmtMonthDay(d)}${
                disabled ? " (no showtimes)" : ""
              }`}
            >
              <div
                className={`text-[11px] ${
                  isToday ? "font-extrabold" : "opacity-70"
                }`}
              >
                {isToday ? "Today" : fmtDayShort(d)}
              </div>
              <div className="text-lg leading-5">{d.getDate()}</div>
              <div className="text-[11px] opacity-70">
                {d.toLocaleString(undefined, { month: "short" })}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function MovieHeader({ movie, movieId }) {
  const poster = resolvePosterUrl(movie?.posterUrl) || DEFAULT_POSTER;
  const langs =
    movie?.language ||
    (Array.isArray(movie?.languages) ? movie.languages.join(", ") : null);
  const runtime = movie?.runtime ?? movie?.durationMins ?? null;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="w-[92px] h-[122px] overflow-hidden rounded-xl border border-slate-200">
          <img
            src={poster}
            alt={movie?.title || "poster"}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="pt-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 truncate">
            {movie?.title || "Movie"}
          </h1>
          <p className="text-slate-700 mt-1">
            {(movie?.censorRating || "UA") +
              (langs ? ` • ${langs}` : "") +
              (runtime ? ` • ${runtime} min` : "")}
          </p>
          <Link
            to={`/movies/${movieId}`}
            className="inline-flex mt-3 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold border border-slate-300 hover:bg-slate-50"
          >
            View details
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ Pure helpers ------------------------------ */
// 🚫 IDs can differ for same slot; dedupe by theater+screen+start(minute)
function dedupeShowtimes(list = []) {
  const map = new Map();
  for (const st of list) {
    const theaterId =
      st.theater?._id || st.theaterId || st.theater?.name || "unknownTheater";
    const screenId =
      st.screen?._id || st.screenId || st.screen?.name || "unknownScreen";
    const t = new Date(
      st.startTime || st.start || st.dateTime || st.time
    ).getTime();
    if (!Number.isFinite(t)) continue;
    const key = `${theaterId}|${screenId}|${Math.floor(t / 60000)}`;
    if (!map.has(key)) map.set(key, st);
  }
  return Array.from(map.values());
}

function groupByTheater(rows) {
  const map = {};
  for (const st of rows) {
    const tId =
      st.theater?._id || st.theaterId || st.theater?.name || "theater";
    const tName = st.theater?.name || st.theaterName || "Theater";
    const tCity = st.theater?.city || st.city || "";
    const screenName = st.screen?.name || st.screenName || "Screen";
    const screenId = st.screen?._id || st.screenId || null;
    (map[tId] ||= { id: tId, name: tName, city: tCity, byScreen: {} });
    (map[tId].byScreen[screenName] ||= []);
    const seatsAvailable =
      st.seatsAvailable ??
      st.availableSeats ??
      st.remainingSeats ??
      st.seatsLeft ??
      (typeof st.totalSeats === "number" &&
      typeof st.bookedSeats === "number"
        ? st.totalSeats - st.bookedSeats
        : undefined);
    map[tId].byScreen[screenName].push({
      _id: st._id,
      start: st.startTime || st.start || st.dateTime,
      seatsAvailable,
      language: st.language,
      format: st.format,
      screenId,
    });
  }
  return map;
}
function seatStatusClass(seatsAvailable) {
  if (!Number.isFinite(seatsAvailable)) return "";
  if (seatsAvailable <= 10) return "ring-2 ring-rose-300";
  if (seatsAvailable <= 25) return "ring-2 ring-amber-300";
  return "ring-2 ring-emerald-300";
}

/* ------------------------------ Config ------------------------------ */
const DAYS_VISIBLE = 14;
const TRY_AVAILABILITY_ENDPOINT = true;

/* ========================================================================== */
export default function Showtimes() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeParams = useParams();

  // state from previous page
  const state = location.state || {};
  const movieIdFromState = state.movieId ?? null;
  const theaterIdFromState = state.theaterId ?? null;
  const screenIdFromState = state.screenId ?? null;
  const dateFromState = state.date ?? null;
  const cityFromState = state.city ?? null;

  // ids from route/query/state
  const movieId =
    movieIdFromState ??
    params.get("movieId") ??
    routeParams.movieId ??
    null;
  const theaterId =
    theaterIdFromState ??
    params.get("theaterId") ??
    routeParams.theaterId ??
    null;
  const screenId =
    screenIdFromState ??
    params.get("screenId") ??
    routeParams.screenId ??
    null;

  // City
  const [selectedCity, setSelectedCity] = useState(
    params.get("city") || cityFromState || ""
  );
  const [cities, setCities] = useState([]);

  // Dates (CLAMP!)
  const todayYMD = useMemo(() => toYmdLocal(new Date()), []);
  const initialYmdRaw = (
    dateFromState ||
    params.get("date") ||
    todayYMD
  ).split("T")[0];
  const [date, setDate] = useState(clampToToday(initialYmdRaw));

  // Data
  const [rows, setRows] = useState([]);

  // Movies
  const [moviesAll, setMoviesAll] = useState([]);
  const [moviesAvail, setMoviesAvail] = useState([]);

  const [selectedMovie, setSelectedMovie] = useState(movieId);
  const [selectedTheater, setSelectedTheater] = useState(theaterId);
  const [selectedScreen, setSelectedScreen] = useState(screenId);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // View + availability
  const [view, setView] = useState(params.get("view") || "calendar");
  const [availabilitySet, setAvailabilitySet] = useState(new Set());
  const windowStart = useMemo(() => new Date(), []);
  const windowDates = useMemo(() => {
    const arr = [];
    const base = new Date(windowStart);
    for (let i = 0; i < DAYS_VISIBLE; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      arr.push(toYmdLocal(d));
    }
    return arr;
  }, [windowStart]);

  /* ---------------------- Cities (real-time from backend) ---------------------- */
  useEffect(() => {
    const loadCities = async () => {
      try {
        if (!date) {
          setCities([]);
          return;
        }
        const ymd = clampToToday(toYmdLocal(fromYmdLocal(date)));
        const { data } = await api.get("/showtimes/cities", {
          params: {
            date: ymd,
            ...(selectedMovie ? { movieId: selectedMovie } : {}),
          },
        });
        const list = Array.isArray(data) ? data : [];
        setCities(list);
        if (selectedCity && !list.includes(selectedCity)) setSelectedCity("");
      } catch {
        setCities([]);
      }
    };
    loadCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMovie, date]);

  /* -------------------------- Sync URL -------------------------- */
  useEffect(() => {
    const anyFilter = selectedMovie || selectedTheater || selectedScreen;
    if (!date || !anyFilter) return;
    const ymd = clampToToday(toYmdLocal(fromYmdLocal(date)));
    const qs = new URLSearchParams({
      ...(selectedMovie ? { movieId: selectedMovie } : {}),
      ...(selectedTheater ? { theaterId: selectedTheater } : {}),
      ...(selectedScreen ? { screenId: selectedScreen } : {}),
      date: ymd,
      ...(selectedCity ? { city: selectedCity } : {}),
      ...(view ? { view } : {}),
    }).toString();
    const path = selectedMovie ? `/showtimes/${selectedMovie}` : `/showtimes`;
    navigate(`${path}?${qs}`, {
      replace: true,
      state: {
        movieId: selectedMovie,
        theaterId: selectedTheater,
        screenId: selectedScreen,
        date: ymd,
        city: selectedCity,
      },
    });
  }, [
    selectedMovie,
    selectedTheater,
    selectedScreen,
    date,
    selectedCity,
    view,
    navigate,
  ]);

  /* ---------------------- Availability for calendar strip ---------------------- */
  useEffect(() => {
    const loadAvailability = async () => {
      if (!TRY_AVAILABILITY_ENDPOINT)
        return setAvailabilitySet(new Set());
      if (!selectedMovie && !selectedTheater && !selectedScreen) {
        setAvailabilitySet(new Set());
        return;
      }
      try {
        const from = windowDates[0];
        const to = windowDates[windowDates.length - 1];
        const { data } = await api.get("/showtimes/availability", {
          params: {
            ...(selectedMovie ? { movieId: selectedMovie } : {}),
            ...(selectedTheater ? { theaterId: selectedTheater } : {}),
            ...(selectedScreen ? { screenId: selectedScreen } : {}),
            ...(selectedCity ? { city: selectedCity } : {}),
            from,
            to,
          },
        });
        const dates = Array.isArray(data?.dates) ? data.dates : [];
        setAvailabilitySet(new Set(dates));
      } catch {
        setAvailabilitySet(new Set());
      }
    };
    loadAvailability();
  }, [
    selectedMovie,
    selectedTheater,
    selectedScreen,
    selectedCity,
    windowDates,
  ]);

  /* ---------------------- Fetch showtimes --------------------- */
  useEffect(() => {
    const fetchShowtimes = async () => {
      if (!date) return;
      if (!selectedMovie && !selectedTheater && !selectedScreen) return;
      setLoading(true);
      setErr("");
      try {
        const ymd = clampToToday(toYmdLocal(fromYmdLocal(date)));
        const { data } = await api.get("/showtimes", {
          params: {
            ...(selectedMovie ? { movieId: selectedMovie } : {}),
            ...(selectedTheater ? { theaterId: selectedTheater } : {}),
            ...(selectedScreen ? { screenId: selectedScreen } : {}),
            ...(selectedCity ? { city: selectedCity } : {}),
            date: ymd,
          },
        });
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setRows(dedupeShowtimes(list)); // ✅ de-dupe applied here
      } catch (e) {
        console.error("Failed to fetch showtimes", e);
        setErr(
          e?.response?.data?.message ||
            e.message ||
            "❌ Failed to fetch showtimes"
        );
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchShowtimes();
  }, [
    selectedMovie,
    selectedTheater,
    selectedScreen,
    selectedCity,
    date,
    retryKey,
  ]);

  /* --------- Fetch all movies once (for poster/runtime in header) --------- */
  useEffect(() => {
    const fetchAllMovies = async () => {
      try {
        const { data } = await api.get("/movies");
        const list = Array.isArray(data?.movies)
          ? data.movies
          : Array.isArray(data)
          ? data
          : [];
        setMoviesAll(list);
      } catch {
        setMoviesAll([]);
      }
    };
    fetchAllMovies();
  }, []);

  /* --------- Fetch movies that actually have shows (real dropdown) -------- */
  useEffect(() => {
    const fetchAvailableMovies = async () => {
      try {
        const ymd = clampToToday(toYmdLocal(fromYmdLocal(date)));
        const { data } = await api.get("/showtimes/movies", {
          params: {
            date: ymd,
            ...(selectedCity ? { city: selectedCity } : {}),
          },
        });
        const avail = Array.isArray(data) ? data : [];
        const map = new Map(moviesAll.map((m) => [m._id, m]));
        const merged = avail.map((m) => ({ ...map.get(m._id), ...m }));
        setMoviesAvail(merged);
        if (
          selectedMovie &&
          !merged.some((m) => m._id === selectedMovie)
        )
          setSelectedMovie(null);
      } catch {
        setMoviesAvail([]);
      }
    };
    if (date) fetchAvailableMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedCity, moviesAll]);

  /* ----------------------- Live updates via SSE notifications ---------------- */
  useNotifications((evt) => {
    if (
      evt?.type === "showtime:created" ||
      evt?.type === "showtime:updated" ||
      evt?.type === "showtime:deleted"
    ) {
      const affectsSameMovie = !evt?.movieId || evt.movieId === selectedMovie;
      const affectsSameTheater =
        !evt?.theaterId || evt.theaterId === selectedTheater;
      const affectsSameScreen =
        !evt?.screenId || evt.screenId === selectedScreen;
      const affectsSameCity =
        !evt?.city ||
        String(evt.city).toLowerCase() ===
          String(selectedCity).toLowerCase();
      const affectsSameDate =
        !evt?.date || evt.date === toYmdLocal(fromYmdLocal(date));
      if (
        affectsSameMovie &&
        affectsSameTheater &&
        affectsSameScreen &&
        affectsSameCity &&
        affectsSameDate
      ) {
        setRetryKey((k) => k + 1);
      }
    }
  });

  /* ------------------------------ Render helpers ------------------------------ */
  const nothingSelected =
    !selectedMovie && !selectedTheater && !selectedScreen;
  const headerMovie =
    moviesAll.find((m) => m._id === selectedMovie) ||
    moviesAvail.find((m) => m._id === selectedMovie);

  // memoize grouping to avoid recalculation every render
  const theaterGroups = useMemo(
    () => groupByTheater(rows),
    [rows]
  );

  return (
    <main className="min-h-screen w-screen [margin-inline:calc(50%-50vw)] bg-slate-50 text-slate-900">
      <div className="px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="h-5" />

        {/* Landing (no selection) */}
        {nothingSelected ? (
          <div className="min-h-[60vh] pt-2">
            <header className="mb-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Showtimes
              </h1>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Date strip preview */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-extrabold">Pick a date</h2>
                  <ViewToggle view={view} onChange={setView} />
                </div>
                {view === "calendar" && (
                  <CalendarStrip
                    startDate={new Date()}
                    days={DAYS_VISIBLE}
                    selectedDate={date}
                    onSelect={(d) => setDate(clampToToday(d))}
                    availabilitySet={null}
                  />
                )}
                <div className="mt-4">
                  <label className="block text-sm text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date || todayYMD}
                    min={todayYMD}
                    onChange={(e) =>
                      setDate(clampToToday(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                  />
                </div>
              </Card>

              {/* Filters */}
              <Card className="p-5">
                <h2 className="text-base font-extrabold mb-3">
                  Find a show
                </h2>
                <div className="space-y-4">
                  {/* Movie */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">
                      Movie
                    </label>
                    <select
                      value={selectedMovie || ""}
                      onChange={(e) => {
                        setSelectedTheater(null);
                        setSelectedScreen(null);
                        setSelectedCity("");
                        setSelectedMovie(e.target.value || null);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                    >
                      <option value="">-- Choose a movie --</option>
                      {moviesAvail.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                    {!moviesAvail.length && (
                      <p className="text-xs text-slate-600 mt-1">
                        No movies with showtimes for the selected date/city
                        yet.
                      </p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm text-slate-700 mb-1">
                      City
                    </label>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071DC]"
                    >
                      <option value="">-- All cities --</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {!cities.length && (
                      <p className="text-xs text-slate-600 mt-1">
                        No cities for this date yet — shows will load for
                        all cities.
                      </p>
                    )}
                  </div>

                  <PrimaryBtn
                    onClick={() => {
                      if (!selectedMovie)
                        return alert("Please select a movie first.");
                      if (!date) return alert("Please select a date.");
                      const ymd = clampToToday(
                        toYmdLocal(fromYmdLocal(date))
                      );
                      const qs = new URLSearchParams({
                        movieId: selectedMovie,
                        date: ymd,
                        ...(selectedCity ? { city: selectedCity } : {}),
                        view,
                      }).toString();
                      navigate(`/showtimes/${selectedMovie}?${qs}`, {
                        state: {
                          movieId: selectedMovie,
                          date: ymd,
                          city: selectedCity,
                        },
                      });
                    }}
                    className="w-full mt-1"
                  >
                    View Showtimes
                  </PrimaryBtn>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <>
            {/* Top row */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <GhostBtn
                  onClick={() => {
                    if (window.history.length > 2) navigate(-1);
                    else navigate("/movies");
                  }}
                >
                  ← Back
                </GhostBtn>
              </div>
              <ViewToggle view={view} onChange={setView} />
            </div>

            {/* Movie header */}
            {selectedMovie && (
              <div className="mb-4">
                <MovieHeader movie={headerMovie} movieId={selectedMovie} />
              </div>
            )}

            {/* Calendar strip */}
            <div
              className={`${view === "list" ? "hidden md:block" : ""} mb-4`}
            >
              <CalendarStrip
                startDate={new Date()}
                days={DAYS_VISIBLE}
                selectedDate={date}
                onSelect={(d) => setDate(clampToToday(d))}
                availabilitySet={availabilitySet}
              />
            </div>

            {/* Loading / Error / Content */}
            {loading ? (
              <div className="text-center mt-10">
                <div className="inline-block w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-3 font-extrabold">Loading showtimes…</p>
              </div>
            ) : err ? (
              <div className="max-w-lg mx-auto mt-10">
                <Card className="text-center p-6">
                  <h2 className="text-xl font-extrabold mb-2">
                    {err
                      ?.toLowerCase()
                      ?.includes("no showtimes")
                      ? "No showtimes found for selected filters"
                      : "Something went wrong"}
                  </h2>
                  <p className="text-slate-700 mb-5">
                    {err
                      ?.toLowerCase()
                      ?.includes("no showtimes")
                      ? "Please try another date or choose a different movie/theater/screen."
                      : "Unable to load showtimes. Please try again later."}
                  </p>
                  <PrimaryBtn
                    onClick={() => {
                      setErr("");
                      setDate(toYmdLocal(new Date()));
                      setRetryKey((k) => k + 1);
                    }}
                  >
                    Retry
                  </PrimaryBtn>
                </Card>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-slate-700 mt-14">
                <Card className="inline-block p-6">
                  <p className="text-lg font-extrabold">
                    No showtimes found for these filters.
                  </p>
                  <Link
                    to="/movies"
                    className="inline-flex mt-4 items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold border border-slate-300 hover:bg-slate-50"
                  >
                    ← Back to Movies
                  </Link>
                </Card>
              </div>
            ) : view === "list" ? (
              /* ---------- LIST VIEW ---------- */
              <ul className="space-y-4">
                {rows.map((st) => (
                  <li key={st._id}>
                    <Card className="p-5 hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-extrabold">
                              {st.movie?.title || "Untitled Movie"}
                            </h2>
                            {st.format && <Chip>{st.format}</Chip>}
                            {st.language && <Chip>{st.language}</Chip>}
                          </div>
                          <p className="text-slate-700 text-sm mt-0.5">
                            🎟 {st.screen?.name || "Screen"}
                            {st.theater?.name
                              ? ` • ${st.theater?.name}`
                              : ""}
                          </p>
                          <p className="text-sm text-slate-700 mt-1">
                            🕒{" "}
                            {new Date(
                              st.startTime || st.start
                            ).toLocaleString()}
                          </p>
                          <p className="text-sm font-bold mt-1">
                            ₹{st.basePrice ?? 200} / ticket
                          </p>
                        </div>
                        <PrimaryBtn
                          as={Link}
                          to={`/seats/${st._id}`}
                          state={{
                            showtimeId: st._id,
                            movieId: selectedMovie || null,
                            theaterId:
                              selectedTheater || st.theater?._id || null,
                            screenId:
                              selectedScreen || st.screen?._id || null,
                            date: toYmdLocal(fromYmdLocal(date)),
                            city: selectedCity,
                          }}
                        >
                          Select Seats
                        </PrimaryBtn>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              /* ---------- CALENDAR VIEW ---------- */
              <div className="space-y-4">
                {Object.entries(theaterGroups).map(
                  ([theaterKey, block]) => (
                    <Card key={theaterKey}>
                      <div className="px-4 py-3 border-b border-slate-200 rounded-t-2xl bg-white">
                        <h3 className="text-base font-extrabold">
                          {block.name || "Theater"}
                        </h3>
                        <p className="text-xs text-slate-700">
                          {block.city || ""}
                        </p>
                      </div>
                      <div className="px-4 py-3">
                        <div className="space-y-3">
                          {Object.entries(block.byScreen).map(
                            ([screenName, slots]) => (
                              <div key={screenName}>
                                <div className="text-sm text-slate-700 mb-1 font-semibold">
                                  {screenName}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {slots
                                    .sort(
                                      (a, b) =>
                                        new Date(a.start) -
                                        new Date(b.start)
                                    )
                                    .map((s) => {
                                      const isSoldOut =
                                        Number.isFinite(
                                          s.seatsAvailable
                                        ) && s.seatsAvailable <= 0;
                                      const timeLabel =
                                        new Date(
                                          s.start
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        });
                                      if (isSoldOut) {
                                        // non-interactive sold-out pill
                                        return (
                                          <div
                                            key={s._id}
                                            className={`px-3 py-1.5 text-sm rounded-full border bg-slate-200 cursor-not-allowed ${seatStatusClass(
                                              s.seatsAvailable
                                            )}`}
                                            title={`Sold out • ${timeLabel}`}
                                            aria-disabled="true"
                                          >
                                            {timeLabel}
                                            <span className="ml-2 text-xs opacity-80">
                                              (Sold out)
                                            </span>
                                          </div>
                                        );
                                      }
                                      return (
                                        <Link
                                          key={s._id}
                                          to={`/seats/${s._id}`}
                                          state={{
                                            showtimeId: s._id,
                                            movieId:
                                              selectedMovie || null,
                                            theaterId:
                                              block.id || null,
                                            screenId:
                                              s.screenId || null,
                                            date: toYmdLocal(
                                              fromYmdLocal(date)
                                            ),
                                            city: selectedCity,
                                          }}
                                          className={`px-3 py-1.5 text-sm rounded-full border bg-white hover:bg-slate-50 ${seatStatusClass(
                                            s.seatsAvailable
                                          )}`}
                                          title={`${timeLabel} • ${
                                            s.format || ""
                                          } ${
                                            s.language || ""
                                          }${
                                            Number.isFinite(
                                              s.seatsAvailable
                                            )
                                              ? ` • ${s.seatsAvailable} seats left`
                                              : ""
                                          }`}
                                        >
                                          {timeLabel}
                                        </Link>
                                      );
                                    })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* tiny CSS helpers */}
        <style>{`
          .hide-scrollbar { scrollbar-width: none; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        <div className="h-10" />
      </div>
    </main>
  );
}
