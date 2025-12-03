// src/pages/MovieDetail.jsx — Walmart Style (clean, rounded, blue accents)
// Updated: defensive fetching, AbortController, accessibility & small UX fixes

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag
    className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

const Field = ({ type = "text", icon, placeholder, value, onChange, autoComplete, ...rest }) => (
  <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
    {icon ? <span className="text-slate-600">{icon}</span> : null}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      autoComplete={autoComplete}
      className="w-full outline-none bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400"
      required={rest.required}
      aria-label={placeholder}
    />
  </div>
);

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

function LinkBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`font-semibold text-[#0071DC] hover:text-[#0654BA] underline underline-offset-4 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Inline icons ------------------------------ */
const iconClass = "h-5 w-5 flex-shrink-0 text-slate-600";
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
};

const IconX = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <path {...stroke} d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const IconGlobe = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <circle {...stroke} cx="12" cy="12" r="9" />
    <path {...stroke} d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </svg>
);
const IconTag = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <path {...stroke} d="M20 13l-7 7-9-9V4h7l9 9z" />
    <circle {...stroke} cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
const IconClock = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <circle {...stroke} cx="12" cy="12" r="9" />
    <path {...stroke} d="M12 7v6l4 2" />
  </svg>
);
const IconCalendar = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <rect {...stroke} x="3" y="4.5" width="18" height="16" rx="2" />
    <path {...stroke} d="M8 3v3M16 3v3M3 10h18" />
  </svg>
);
const IconImage = (p) => (
  <svg viewBox="0 0 24 24" className={iconClass} {...p}>
    <rect {...stroke} x="3.5" y="5.5" width="17" height="13" rx="2" />
    <circle {...stroke} cx="9" cy="10" r="1.5" />
    <path {...stroke} d="M5.5 16l4-3 3 2 3.5-3.5 4.5 4.5" />
  </svg>
);
const IconArrow = (p) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...p}>
    <path {...stroke} d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

/* ---------------- helpers ---------------- */
const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
};
const humanDate = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
};
const humanTime = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const titleCase = (s = "") => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
const uniqSorted = (arr) =>
  [...new Set(arr.map((c) => (c || "").trim()))]
    .filter(Boolean)
    .map(titleCase)
    .sort((a, b) => a.localeCompare(b));
const toArray = (v) =>
  Array.isArray(v) ? v : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

/* ---------- Cast parsing helpers ---------- */
function fromPerCharObject(objLike) {
  const vals = Object.values(objLike).filter(Boolean);
  const perChar = vals.length > 5 && vals.every((v) => typeof v === "string" && v.length === 1);
  if (!perChar) return null;
  const joined = vals.join("");
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}

function normalizeCastItem(item) {
  if (typeof item === "string") return { actorName: item.trim() };
  if (item && typeof item === "object") {
    if (item.actorName || item.name || item.character) {
      return { actorName: (item.actorName || item.name || "").trim(), character: item.character || undefined };
    }
    const maybe = fromPerCharObject(item);
    if (maybe !== null) {
      if (Array.isArray(maybe)) {
        const first = maybe.find((x) => (typeof x === "string" && x.trim()) || (x && (x.actorName || x.name)));
        if (typeof first === "string") return { actorName: first.trim() };
        if (first && (first.actorName || first.name)) {
          return { actorName: (first.actorName || first.name).trim(), character: first.character || undefined };
        }
        return { actorName: maybe.filter(Boolean).join(", ").trim() };
      }
      if (typeof maybe === "string") {
        const names = maybe.split(",").map((s) => s.trim()).filter(Boolean);
        return { actorName: names[0] || "" };
      }
      if (maybe && typeof maybe === "object") {
        const val = Object.values(maybe).find((v) => typeof v === "string" && v.trim());
        if (val) return { actorName: val.trim() };
      }
    }
    const val = Object.values(item).find((v) => typeof v === "string" && v.trim());
    if (val) return { actorName: val.trim() };
  }
  return { actorName: String(item ?? "").trim() };
}

function parseCast(anyCast) {
  if (!anyCast) return [];
  if (Array.isArray(anyCast)) return anyCast.map((c) => normalizeCastItem(c)).filter((x) => x && x.actorName);
  if (typeof anyCast === "object") {
    const reconstructed = fromPerCharObject(anyCast);
    if (reconstructed !== null) return parseCast(reconstructed);
    const vals = Object.values(anyCast).filter(Boolean);
    return vals.map((v) => normalizeCastItem(v)).filter((x) => x && x.actorName);
  }
  if (typeof anyCast === "string") {
    const s = anyCast.trim();
    if (!s) return [];
    try {
      return parseCast(JSON.parse(s));
    } catch {
      return s.split(",").map((x) => x.trim()).filter(Boolean).map((name) => ({ actorName: name }));
    }
  }
  return [];
}

/* ---------- normalizeMovie (fixed) ---------- */
function normalizeMovie(m = {}) {
  const genres = m.genres ? toArray(m.genres) : m.genre ? [String(m.genre)] : [];
  const languages = m.languages ? toArray(m.languages) : m.language ? [String(m.language)] : ["English"];

  const runtime =
    typeof m.runtime === "number"
      ? m.runtime
      : typeof m.durationMins === "number"
      ? m.durationMins
      : typeof m.runtimeMinutes === "number"
      ? m.runtimeMinutes
      : m.runtime
      ? Number(m.runtime)
      : undefined;

  const releasedAt = m.releasedAt ?? m.releaseDate ?? m.released_at ?? null;
  const releaseDate = m.releaseDate ?? m.releasedAt ?? (releasedAt ? new Date(releasedAt).toISOString() : null);

  const cast = parseCast(m.cast);
  const crew = Array.isArray(m.crew) ? m.crew : m.crew ? parseCast(m.crew) : [];

  return { ...m, genres, languages, runtime, cast, crew, releasedAt, releaseDate };
}

/* -------------------------------------------------------------------------- */
export default function MovieDetail() {
  const { movieId: routeMovieId } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [err, setErr] = useState("");

  const [date, setDate] = useState(toYMD(new Date()));
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState("");
  const [showtimes, setShowtimes] = useState([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(false);

  const [tab, setTab] = useState("synopsis");
  const dialogRef = useRef(null);

  /* ------------------------ Fetch movie details (defensive) ------------------------ */
  useEffect(() => {
    if (!routeMovieId) return;
    const controller = new AbortController();
    let mounted = true;

    (async () => {
      try {
        setLoadingMovie(true);
        setErr("");
        const resp = await api.get(`/movies/${routeMovieId}`, { signal: controller.signal });
        // handle different server shapes robustly
        const movieData = resp?.data?.data ?? resp?.data ?? resp;
        if (!mounted) return;
        setMovie(normalizeMovie(movieData || {}));
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("❌ Movie fetch failed:", e);
        setErr(e?.response?.data?.message || "❌ Failed to load movie details.");
      } finally {
        if (mounted) setLoadingMovie(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [routeMovieId]);

  /* --------------------- Fetch city list & showtimes (defensive) --------------------- */
  useEffect(() => {
    if (!routeMovieId || !date) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const found = new Set();
      try {
        // primary endpoint: showtimes/cities
        const r = await api.get("/showtimes/cities", {
          params: { movieId: routeMovieId, date },
          signal: controller.signal,
        });
        const citiesPayload = r?.data?.data ?? r?.data ?? r;
        if (Array.isArray(citiesPayload)) citiesPayload.forEach((c) => found.add(c));
      } catch (e) {
        if (controller.signal.aborted) return;
        // swallow — try fallbacks
      }

      try {
        if (!found.size) {
          const r = await api.get("/theaters", { params: { limit: 1000 }, signal: controller.signal });
          const theaters = r?.data?.theaters ?? r?.data ?? [];
          if (Array.isArray(theaters)) theaters.forEach((t) => t?.city && found.add(t.city));
        }
      } catch (e) {
        if (controller.signal.aborted) return;
      }

      try {
        if (!found.size) {
          const r = await api.get("/showtimes", { params: { movieId: routeMovieId, date }, signal: controller.signal });
          const st = r?.data?.data ?? r?.data ?? r;
          if (Array.isArray(st)) st.map((s) => s?.theater?.city).filter(Boolean).forEach((c) => found.add(c));
        }
      } catch (e) {
        if (controller.signal.aborted) return;
      }

      if (!cancelled) {
        const final = uniqSorted([...found]);
        setCities(final);
        setCity((curr) => (curr && final.includes(curr) ? curr : final[0] || ""));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeMovieId, date]);

  useEffect(() => {
    if (!routeMovieId || !date || !city) {
      setShowtimes([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setLoadingShowtimes(true);
        setErr("");
        const r = await api.get("/showtimes", {
          params: { movieId: routeMovieId, city, date },
          signal: controller.signal,
        });
        const payload = r?.data?.data ?? r?.data ?? r;
        if (!cancelled) setShowtimes(Array.isArray(payload) ? payload : []);
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("❌ Showtimes fetch failed:", e);
        setShowtimes([]);
        setErr(e?.response?.data?.message || "❌ Failed to load showtimes.");
      } finally {
        if (!cancelled) setLoadingShowtimes(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeMovieId, city, date]);

  /* ---------------------- Group showtimes by theater ---------------------- */
  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of showtimes || []) {
      const thId = s?.theater?._id || s?.theater?.id || `${s?.theater?.name || "unknown"}-${s?.theater?.city || "?"}`;
      if (!map.has(thId)) {
        map.set(thId, {
          id: thId,
          name: s?.theater?.name || "Unknown Theater",
          city: s?.theater?.city || "",
          address: s?.theater?.address || "",
          items: [],
        });
      }
      map.get(thId).items.push(s);
    }
    const arr = Array.from(map.values());
    for (const g of arr) g.items.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return arr.sort((a, b) => a.name.localeCompare(b.name));
  }, [showtimes]);

  const goToShowtimesPage = () => {
    const mid = routeMovieId || movie?._id;
    if (!mid || !city) return;
    navigate(`/showtimes/${mid}?movieId=${mid}&date=${date}&city=${encodeURIComponent(city)}`);
  };

  /* ----------------------------- Close handlers ---------------------------- */
  const close = () => navigate(-1);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  /* ------------------------------- UI States ------------------------------ */
  if (loadingMovie)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur">
        <div className="animate-spin h-10 w-10 border-4 border-white/70 border-t-transparent rounded-full" />
      </div>
    );

  if (err)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur p-4">
        <Card className="max-w-lg w-full text-center p-4 text-rose-700">
          {err}
          <div className="mt-4">
            <PrimaryBtn onClick={close} className="bg-[#FFC220] text-[#111827] hover:bg-yellow-400">
              Close
            </PrimaryBtn>
          </div>
        </Card>
      </div>
    );

  if (!movie) return null;

  /* ---------------------------- Render Modal ----------------------------- */
  const posterSources = [movie.poster, movie.posterUrl, ...(movie.images || [])].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 backdrop-blur-sm p-3 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-modal="true"
      role="dialog"
    >
      <Card ref={dialogRef} className="w-full max-w-3xl md:max-w-4xl overflow-hidden" tabIndex={-1}>
        {/* Header */}
        <div className="px-6 md:px-8 pt-5 md:pt-6 pb-3 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl md:text-2xl font-extrabold tracking-tight">Movie Details</div>
              <div className="text-slate-600 text-sm md:text-base mt-0.5 font-medium">{movie.title}</div>
            </div>
            <button
              onClick={close}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
              aria-label="Close movie details"
            >
              <IconX />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 text-sm md:text-base">
            {[
              ["synopsis", "Synopsis"],
              ["cast", "Cast & Crew"],
              ["posters", "Posters"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-full font-semibold transition ${tab === key ? "bg-[#0071DC] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                aria-pressed={tab === key}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 py-6">
          {tab === "synopsis" && (
            <div className="space-y-5">
              {movie.description && (
                <>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Synopsis</div>
                  <p className="text-slate-800 leading-7">{movie.description}</p>
                </>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <IconGlobe />
                  <div>
                    <div className="text-xs text-slate-500">Languages</div>
                    <div className="font-semibold text-slate-800">{movie.languages?.join(", ") || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconTag />
                  <div>
                    <div className="text-xs text-slate-500">Genres</div>
                    <div className="font-semibold text-slate-800">{movie.genres?.join(", ") || "—"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconClock />
                  <div>
                    <div className="text-xs text-slate-500">Duration</div>
                    <div className="font-semibold text-slate-800">
                      {typeof movie.runtime === "number" && !Number.isNaN(movie.runtime) ? `${movie.runtime} mins` : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <IconCalendar />
                  <div>
                    <div className="text-xs text-slate-500">Release</div>
                    <div className="font-semibold text-slate-800">
                      {(movie.releaseDate || movie.releasedAt) ? humanDate(movie.releaseDate || movie.releasedAt) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Poster strip */}
              <div className="pt-2 flex gap-3 overflow-x-auto hide-scrollbar">
                {posterSources.length ? posterSources.slice(0, 6).map((src, i) => (
                  <div key={i} className="shrink-0">
                    <Card className="p-1">
                      <img
                        src={src}
                        alt={movie.title ? `${movie.title} poster ${i+1}` : `Poster ${i+1}`}
                        className="h-14 w-14 object-cover rounded-xl"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.opacity = 0.6; }}
                      />
                    </Card>
                  </div>
                )) : (
                  <div className="text-slate-600">No posters available.</div>
                )}
              </div>
            </div>
          )}

          {tab === "cast" && (
            <div className="space-y-5">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Cast & Crew</div>
              {movie.cast?.length ? (
                <div className="flex flex-wrap gap-2">
                  {movie.cast.map((c, i) => (
                    <span key={i} className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 bg-white text-sm text-slate-800">
                      {c.actorName}{c.character ? <span className="text-slate-600"> — {c.character}</span> : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-slate-600 text-sm">No cast data.</div>
              )}
              {movie.crew?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {movie.crew.map((c, i) => (
                    <span key={i} className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 bg-white text-sm text-slate-800">
                      {c.name}{c.role ? ` (${c.role})` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {tab === "posters" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800"><IconImage /><span>Posters</span></div>
              {posterSources.length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {posterSources.map((src, i) => (
                    <Card key={i} className="overflow-hidden">
                      <img src={src} alt={movie.title ? `${movie.title} poster ${i+1}` : `Poster ${i+1}`} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-slate-600 text-sm">No posters.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer — City/Date + Open Showtimes */}
        <div className="px-6 md:px-8 pb-6 md:pb-7 pt-3 border-t border-slate-200">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 font-semibold">City</span>
              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 border border-slate-300 rounded-xl bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-transparent outline-none text-sm w-full"
                    aria-label="Select city"
                  >
                    {cities.length ? (
                      cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    ) : (
                      <option value="">No cities</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 font-semibold">Date</span>
              <div className="min-w-[160px]">
                <Field
                  type="date"
                  value={date}
                  onChange={setDate}
                  aria-label="Select date"
                />
              </div>
            </div>

            <div className="md:ml-auto flex items-center gap-3">
              <span className="text-xs text-slate-600 hidden md:inline">
                {city ? `Showtimes in ${city} • ${humanDate(date)}` : ""}
              </span>
              <PrimaryBtn
                onClick={goToShowtimesPage}
                disabled={!city}
                className={`${!city ? "opacity-60 cursor-not-allowed" : ""}`}
                aria-disabled={!city}
                title={!city ? "Choose a city to open showtimes" : "Open showtimes"}
              >
                Open Showtimes <IconArrow />
              </PrimaryBtn>
            </div>
          </div>

          {/* Inline quick-peek list */}
          {city && (
            <div className="mt-4">
              {loadingShowtimes && <div className="text-sm text-slate-600">Loading showtimes…</div>}
              {!loadingShowtimes && grouped.length === 0 && (
                <div className="text-sm text-slate-600">No showtimes found for this date/city.</div>
              )}
              <div className="mt-2 space-y-3 max-h-40 overflow-auto pr-1">
                {grouped.map((th) => (
                  <div key={th.id} className="text-sm">
                    <div className="font-semibold text-slate-800">{th.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {th.items.map((s) => {
                        const disabled = s.seatsAvailable === 0 || s.available === 0;
                        const start = s.startTime || s.startsAt || s.time;
                        return (
                          <Link
                            key={s._id || s.id || start}
                            to={`/seats/${s._id || s.id}`}
                            className={`inline-flex items-center rounded-full px-3 py-1.5 font-semibold border border-slate-300 transition ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100" : "bg-white hover:bg-slate-50"}`}
                            aria-disabled={disabled}
                          >
                            {humanTime(start)}{s.screenName ? ` • ${s.screenName}` : ""}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Soft poster ghost in backdrop */}
      <div className="hidden md:block absolute left-6 bottom-6 pointer-events-none opacity-10">
        {posterSources[0] && (
          <Card className="p-1">
            <img src={posterSources[0]} alt={`${movie.title} poster`} className="w-40 h-60 object-cover rounded-xl" loading="lazy" />
          </Card>
        )}
      </div>
    </div>
  );
}
