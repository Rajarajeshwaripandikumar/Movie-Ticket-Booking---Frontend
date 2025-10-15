import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/api";

/* ---------- Shared media helpers ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";
const FILES_BASE = API_BASE.replace(/\/api\/?$/, "");

function resolvePosterUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${FILES_BASE}${url}`;
}

const DEFAULT_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='240' height='360'>
      <rect width='100%' height='100%' fill='#f1f5f9'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial' font-size='18' fill='#94a3b8'>No Image</text>
    </svg>
  `);

/* ----------------------------- Helpers -------------------------------- */
const toArray = (v) =>
  Array.isArray(v)
    ? v
    : typeof v === "string"
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

function fromPerCharObject(objLike) {
  if (!objLike || typeof objLike !== "object" || Array.isArray(objLike)) return null;
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
  if (!item) return null;
  if (typeof item === "string") {
    const s = item.trim();
    return s ? { actorName: s } : null;
  }
  if (typeof item === "object") {
    if (item.actorName || item.name) {
      return { actorName: (item.actorName || item.name).trim(), character: item.character || undefined };
    }
    const maybe = fromPerCharObject(item);
    if (maybe !== null) return normalizeCastItem(maybe);
    const v = Object.values(item).find((x) => typeof x === "string" && x.trim());
    return v ? { actorName: v.trim() } : null;
  }
  const s = String(item).trim();
  return s ? { actorName: s } : null;
}

function parseCast(anyCast) {
  if (!anyCast) return [];
  if (Array.isArray(anyCast)) return anyCast.map(normalizeCastItem).filter(Boolean);
  if (typeof anyCast === "object") {
    const reconstructed = fromPerCharObject(anyCast);
    if (reconstructed !== null) return parseCast(reconstructed);
    return Object.values(anyCast).map(normalizeCastItem).filter(Boolean);
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

function normalizeMovie(m = {}) {
  const id = m._id || m.id;
  const posterUrl = m.posterUrl || m.poster || "";
  const genresArr = toArray(m.genres?.length ? m.genres : m.genre);
  const genreStr = genresArr.join(", ");
  const runtime =
    typeof m.runtime === "number"
      ? m.runtime
      : typeof m.durationMins === "number"
      ? m.durationMins
      : undefined;
  const languages = toArray(m.languages ?? m.language);
  const castObjs = parseCast(m.cast);
  const castPreview = castObjs.map((c) => c.actorName).filter(Boolean).slice(0, 2);

  return { ...m, _id: id, posterUrl, genre: genreStr, runtime, languages, castPreview };
}

async function tryGet(candidates, params = {}) {
  for (const ep of candidates) {
    try {
      const { data } = await api.get(ep, { params });
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.movies)) return data.movies;
      if (Array.isArray(data?.data)) return data.data;
    } catch {
      /* continue */
    }
  }
  return [];
}

/* --------------------------- Walmart Primitives --------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

/* polymorphic buttons (Link-compatible) */
const cx = (...a) => a.filter(Boolean).join(" ");
const PrimaryBtn = ({ as: As = "button", to, href, className = "", children, ...props }) => (
  <As
    {...(to ? { to } : {})}
    {...(href ? { href } : {})}
    {...props}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold",
      "text-white bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]",
      className
    )}
  >
    {children}
  </As>
);
const GhostBtn = ({ as: As = "button", to, href, className = "", children, ...props }) => (
  <As
    {...(to ? { to } : {})}
    {...(href ? { href } : {})}
    {...props}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
      "border border-slate-300 text-slate-800 bg-white hover:bg-slate-50",
      className
    )}
  >
    {children}
  </As>
);

const IconSearch = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
  </svg>
);
const IconArrow = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
  </svg>
);

/* -------------------------- Movies Page --------------------------- */
export default function Movies() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const debouncedQ = useDebounce(q, 400);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let mounted = true;
    const fetchMovies = async () => {
      setLoading(true);
      setErr("");
      const list = await (async () => {
        try {
          if (debouncedQ) return await tryGet(["/api/movies/search", "/movies/search"], { q: debouncedQ });
          return await tryGet(["/api/movies", "/movies"]);
        } catch (e) {
          console.error("Movies fetch failed:", e);
          setErr(e?.response?.data?.message || "Failed to fetch movies");
          return [];
        }
      })();
      if (!mounted) return;
      setMovies(list.map(normalizeMovie));
      if (debouncedQ) setParams({ q: debouncedQ }); else setParams({});
      setLoading(false);
    };
    fetchMovies();
    return () => { mounted = false; };
  }, [debouncedQ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Centered header + search */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-4 pb-3">
        <header className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Only in Theatres</h1>
        </header>

        <div className="mt-2 max-w-[640px]">
          <SearchBar
            value={q}
            onChange={setQ}
            onClear={() => setQ("")}
            placeholder="Search movies, cast, or genres"
            className="w-full"
          />
        </div>
      </div>

      {/* Centered cards area, left-aligned inside */}
      <section className="pb-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          {err && (
            <Card className="mb-6 p-4 bg-rose-50 border-rose-200 text-rose-700 font-semibold">{err}</Card>
          )}

          {loading && (
            <div className="flex flex-wrap gap-4 justify-start">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-[240px]">
                  <Card className="p-3 animate-pulse">
                    <div className="bg-slate-200 aspect-[2/3] w-full mb-3 rounded-xl" />
                    <div className="h-4 w-3/4 bg-slate-200 mb-2 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  </Card>
                </div>
              ))}
            </div>
          )}

          {!loading && movies.length > 0 && (
            <ul className="flex flex-wrap gap-4 justify-start">
              {movies.map((m) => (
                <li key={m._id} className="group w-[240px]">
                  <Card className="p-3 transition-transform duration-200 group-hover:-translate-y-0.5">
                    <PosterBox movie={m} />
                    <div className="mt-3">
                      <h3 className="text-sm sm:text-base font-extrabold leading-snug line-clamp-2">{m.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-1">
                        {m.genre || (m.languages?.length ? m.languages.slice(0, 3).join(", ") : " ")}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <GhostBtn as={Link} to={`/movies/${m._id}`}>Details</GhostBtn>
                        <PrimaryBtn
                          as={Link}
                          to={`/showtimes?movieId=${m._id}&date=${today}`}
                          state={{ movieId: m._id, date: today }}
                        >
                          Book <IconArrow />
                        </PrimaryBtn>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {!loading && movies.length === 0 && !err && (
            <div className="py-16 text-center">
              <Card className="inline-flex flex-col items-center justify-center px-10 py-12">
                <div className="mb-4 text-slate-600"><span className="text-4xl">🎬</span></div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">No movies found</h2>
                <p className="mt-2 text-sm text-slate-600">Try searching a different title, cast, or genre.</p>
                <div className="mt-5">
                  <PrimaryBtn as={Link} to="/movies">
                    Browse All Movies <IconArrow />
                  </PrimaryBtn>
                </div>
              </Card>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/* ---------- SearchBar (Walmart) ---------- */
function SearchBar({ value, onChange, onClear, placeholder = "Search", className = "" }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`w-full ${className}`}>
      <Card className="px-4 py-2.5 flex items-center gap-3">
        <span className="text-slate-500"><IconSearch className="w-5 h-5" /></span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 outline-none bg-transparent text-sm sm:text-base placeholder:text-slate-400"
        />
        {value ? (
          <GhostBtn type="button" onClick={onClear}>Clear</GhostBtn>
        ) : (
          <kbd className="select-none rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 bg-white">/</kbd>
        )}
      </Card>
    </div>
  );
}

/* ---------- PosterBox ---------- */
function PosterBox({ movie }) {
  const src = resolvePosterUrl(movie.posterUrl) || DEFAULT_POSTER;
  return (
    <div className="w-full aspect-[2/3] overflow-hidden rounded-xl border border-slate-200 bg-white">
      <img
        src={src}
        alt={movie.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        onError={(e) => (e.currentTarget.src = DEFAULT_POSTER)}
      />
    </div>
  );
}

/* ---------- Debounce ---------- */
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
