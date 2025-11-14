// src/pages/TheatersPage.jsx — Walmart Style (clean, rounded, blue accents)
// Updated: debounce search, AbortController in loadTheaters, robust parsing & response handling

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import Logo from "../components/Logo";
import TheaterCard from "../components/TheaterCard";

/* ✅ Master amenities list (always show all 7) */
const MASTER_AMENITIES = ["Parking", "Snacks", "AC", "Wheelchair", "3D", "IMAX", "Dolby Atmos"];

const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
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

function GhostBtn({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-semibold border border-slate-300 bg-white hover:bg-slate-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- small helpers ---------- */
const norm = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const titleCase = (s = "") =>
  String(s)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

/* ---------- debounce hook ---------- */
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function TheatersPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 450);
  const [cityFilter, setCityFilter] = useState("All");
  const [amenityFilter, setAmenityFilter] = useState("All");

  const [theaters, setTheaters] = useState([]);
  const [cities, setCities] = useState([]);
  const [amenities, setAmenities] = useState(["All", ...MASTER_AMENITIES]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // derive API base origin for relative image paths
  const apiBase = useMemo(() => {
    try {
      const u = new URL(api?.defaults?.baseURL || window.location.origin);
      return u.origin;
    } catch {
      return window.location.origin;
    }
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveImageUrl = (t) => {
    const raw = t?.imageUrl || t?.posterUrl || t?.poster || t?.image || t?.theaterImage || "";
    if (!raw) return "/no-image.png";
    const full = /^https?:\/\//i.test(raw) ? raw : `${apiBase}${raw.startsWith("/") ? "" : "/"}${raw}`;
    const v = t?.updatedAt ? new Date(t.updatedAt).getTime() : null;
    return v ? `${full}${full.includes("?") ? "&" : "?"}v=${v}` : full;
  };

  const normalizeAmenitiesRaw = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((a) => String(a || "").trim()).filter(Boolean);
    if (typeof raw === "string") {
      const s = raw.trim();
      if (!s) return [];
      if (s.startsWith("[") && s.endsWith("]")) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map((a) => String(a || "").trim()).filter(Boolean);
        } catch {}
      }
      return s.split(",").map((x) => String(x || "").trim()).filter(Boolean);
    }
    // fallback: try to coerce object values
    if (typeof raw === "object") return Object.values(raw).map(String).map((x) => x.trim()).filter(Boolean);
    return [];
  };

  const normalizeTheater = (t) => {
    const rawAmenities = normalizeAmenitiesRaw(t?.amenities ?? t?.amentities ?? t?.amenties ?? []);
    const normAmenities = Array.from(new Set(rawAmenities.map((a) => String(a || "").trim()).filter(Boolean)));
    const city = titleCase(t?.city || "");
    return { ...t, amenities: normAmenities, imageUrl: resolveImageUrl(t), city };
  };

  const applyFilters = (items, localQuery = debouncedQuery, localCity = cityFilter, localAmen = amenityFilter) => {
    const q = norm(localQuery);
    const cityN = norm(localCity);
    const amenN = norm(localAmen);

    return items.filter((t) => {
      const tCity = norm(t.city || "");
      const tName = norm(t.name || t.title || "");
      const tAmenities = (t.amenities || []).map(norm);

      const matchesQuery =
        !q ||
        tName.includes(q) ||
        tCity.includes(q) ||
        (t.description || "").toLowerCase().includes(q);
      const matchesCity = localCity === "All" || tCity === cityN;
      const matchesAmenity = localAmen === "All" || tAmenities.includes(amenN);

      return matchesQuery && matchesCity && matchesAmenity;
    });
  };

  const setUrlParams = (overrides = {}) => {
    const sp = new URLSearchParams(search);
    const next = {
      q: debouncedQuery || "",
      city: cityFilter !== "All" ? cityFilter : "",
      amenity: amenityFilter !== "All" ? amenityFilter : "",
      ...overrides,
    };
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    navigate({ search: `?${sp.toString()}` }, { replace: true });
  };

  // firstCitiesLoad to avoid stomping initial param-driven selection
  const firstCitiesLoad = useRef(true);

  useEffect(() => {
    if (!Array.isArray(cities) || cities.length === 0) return;
    if (firstCitiesLoad.current) {
      firstCitiesLoad.current = false;
      return;
    }
    if (cityFilter && cityFilter !== "All") {
      const found = cities.some((c) => String(c).trim().toLowerCase() === String(cityFilter).trim().toLowerCase());
      if (!found) {
        setCityFilter("All");
        setUrlParams();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  useEffect(() => {
    const sp = new URLSearchParams(search);
    const q = sp.get("q");
    const city = sp.get("city");
    const amen = sp.get("amenity");

    if (q !== null) setQuery(q);
    if (city !== null && city.trim()) setCityFilter(city);
    if (amen !== null && amen.trim()) setAmenityFilter(amen);

    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /* ---------- loadTheaters with abort and robust response parsing ---------- */
  const loaderRef = useRef({ controller: null });

  async function loadTheaters({ reset = false, override = {} } = {}) {
    // abort previous
    try {
      if (loaderRef.current.controller) loaderRef.current.controller.abort();
    } catch {}
    loaderRef.current.controller = new AbortController();
    const signal = loaderRef.current.controller.signal;

    setLoading(true);
    setError("");

    try {
      const params = {
       q: override.q ?? (debouncedQuery || undefined),
        city: override.city ?? (cityFilter === "All" ? undefined : cityFilter),
        amenity: override.amenity ?? (amenityFilter === "All" ? undefined : amenityFilter),
        page: reset ? 1 : page,
        limit: 12,
        ts: Date.now(),
      };

      const resp = await api.get("/theaters", { params, signal });

      // support multiple response shapes
      const body = resp?.data ?? resp;
      const fetched =
        Array.isArray(body) ? body : body?.theaters ?? body?.data?.theaters ?? body?.data ?? body?.items ?? body?.results ?? [];

      const normalized = Array.isArray(fetched) ? fetched.map(normalizeTheater) : [];

      // update cities & amenities only on reset (fresh list)
      if (reset) {
        const cityArr = normalized
          .map((t) => (t.city || "").trim())
          .filter(Boolean)
          .map((c) => String(c))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        const uniqueCities = Array.from(new Set(cityArr));
        setCities(["All", ...uniqueCities]);

        // ensure MASTER_AMENITIES are first and preserve extras from data
        const amenSet = new Set(MASTER_AMENITIES);
        normalized.forEach((t) => (t.amenities || []).forEach((a) => a && amenSet.add(String(a).trim())));
        setAmenities(["All", ...Array.from(amenSet)]);
      }

      // apply client-side filters as a fallback
      const filtered = applyFilters(
        normalized,
        override.q ?? debouncedQuery,
        override.city ?? cityFilter,
        override.amenity ?? amenityFilter
      );

      if (reset) {
        setTheaters(filtered);
        setPage(2);
      } else {
        setTheaters((s) => [...s, ...filtered]);
        setPage((p) => p + 1);
      }

      const apiHasMore = typeof body?.hasMore === "boolean" ? body.hasMore : null;
      setHasMore(apiHasMore ?? (Array.isArray(fetched) && fetched.length > 0));
      setUrlParams({
        q: override.q ?? undefined,
        city: override.city ?? undefined,
        amenity: override.amenity ?? undefined,
      });
    } catch (e) {
      if (e?.name === "CanceledError" || e?.name === "AbortError") {
        // silently ignore aborted requests
        return;
      }
      console.error("❌ Failed to load theaters:", e);
      if (mountedRef.current) setError("Unable to load theaters. Please try again later.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  /* initial load & when filters (debounced) change */
  useEffect(() => {
    loadTheaters({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, cityFilter, amenityFilter]);

  const handleCityChange = (value) => {
    const v = value || "All";
    setCityFilter(v);
    setTheaters([]); // clear immediately for snappy UI
    loadTheaters({ reset: true, override: { city: v === "All" ? undefined : v } });
  };

  const handleAmenityChange = (value) => {
    const v = value || "All";
    setAmenityFilter(v);
    setTheaters([]);
    loadTheaters({ reset: true, override: { amenity: v === "All" ? undefined : v } });
  };

  /* ------------------------------ Auto-refresh hooks ------------------------------ */
  useEffect(() => {
    const onFocus = () => loadTheaters({ reset: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") loadTheaters({ reset: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => loadTheaters({ reset: true }), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Navigation helpers ------------------------------ */
  const handleViewShowtimes = (t) => {
    const ymd = new Date().toISOString().slice(0, 10);
    const city = t.city || (cityFilter !== "All" ? cityFilter : "");
    navigate(
      `/showtimes?theaterId=${t._id ?? t.id}&date=${ymd}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
      { state: { theaterId: t._id ?? t.id, date: ymd, city } }
    );
  };

  const handleViewFirstScreen = async (t) => {
    try {
      const resp = await api.get(`/theaters/${t._id}/screens`);
      const body = resp?.data ?? resp;
      const screens = Array.isArray(body) ? body : body?.data ?? body?.items ?? [];
      if (!screens.length) {
        alert("No screens found for this theater yet.");
        return;
      }
      const first = screens[0];
      const city = t.city || (cityFilter !== "All" ? cityFilter : "");
      navigate(`/theaters/${t._id}/screens/${first._id}/showtimes`, {
        state: { theaterId: t._id, screenId: first._id, city },
      });
    } catch (e) {
      console.error("Failed to load screens", e);
      alert("Failed to load screens for this theater.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="max-w-7xl mx-auto px-6 mt-8">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1">
              <SearchBarTheaters
                value={query}
                onChange={(v) => setQuery(v)}
                onClear={() => setQuery("")}
                onSubmit={() => loadTheaters({ reset: true })}
                placeholder="Search by theater name or city"
              />
            </div>

            <div className="flex gap-3 items-center">
              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full bg-white px-4 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
                  <select
                    value={cityFilter}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="bg-transparent outline-none text-sm w-full min-w-[120px]"
                    aria-label="Filter by city"
                  >
                    {(cities.length ? cities : ["All"]).map((c) => (
                      <option key={c} value={c}>
                        {c === "All" ? "All Cities" : c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full bg-white px-4 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
                  <select
                    value={amenityFilter}
                    onChange={(e) => handleAmenityChange(e.target.value)}
                    className="bg-transparent outline-none text-sm w-full"
                    aria-label="Filter by amenity"
                  >
                    {amenities.map((a) => (
                      <option key={a} value={a}>
                        {a === "All" ? "All Amenities" : a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <PrimaryBtn onClick={() => loadTheaters({ reset: true })} className="text-sm">
                Search
              </PrimaryBtn>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <GhostBtn onClick={() => loadTheaters({ reset: true })} className="text-sm">
              Refresh
            </GhostBtn>
          </div>
        </Card>

        {loading && theaters.length === 0 && <div className="text-center py-12 text-slate-600">Loading theaters...</div>}

        {error && !loading && <div className="text-center py-8 text-rose-600 font-medium">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {theaters.length === 0 ? (
              <div className="col-span-full flex justify-center py-12">
                <Card className="px-10 py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-14 h-14 text-slate-400 mb-4 mx-auto">
                    <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                    <path d="M7 4v16M17 4v16M3 8h18M3 16h18" />
                  </svg>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">No theaters found</h2>
                  <p className="mt-2 text-sm text-slate-600">Try a different city or amenity.</p>
                  <PrimaryBtn
                    onClick={() => {
                      setQuery("");
                      setCityFilter("All");
                      setAmenityFilter("All");
                      loadTheaters({ reset: true });
                    }}
                    className="mt-5"
                  >
                    Clear Filters
                  </PrimaryBtn>
                </Card>
              </div>
            ) : (
              theaters.map((t) => (
                <TheaterCard
                  key={t._id || t.id}
                  theater={{
                    ...t,
                    imageUrl: t.imageUrl,
                  }}
                  onViewShowtimes={() => handleViewShowtimes(t)}
                  onViewFirstScreen={() => handleViewFirstScreen(t)}
                />
              ))
            )}
          </div>
        )}

        {!error && theaters.length > 0 && hasMore && (
          <div className="mt-8 flex justify-center">
            <GhostBtn onClick={() => loadTheaters({ reset: false })} className="px-5">
              {loading ? "Loading…" : "Load More"}
            </GhostBtn>
          </div>
        )}
      </section>
    </main>
  );
}

/* ------------------------------ Search Bar (Walmart style) ------------------------------ */
function SearchBarTheaters({ value, onChange, onClear, onSubmit, placeholder = "Search" }) {
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
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        onSubmit?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSubmit]);

  return (
    <div className="w-full">
      <label htmlFor="theater-search" className="sr-only">
        Search theaters
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-slate-400">
            <path
              d="M21 21l-4.3-4.3m1.3-5A7 7 0 1 1 7 4a7 7 0 0 1 11 7.7z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <input
          id="theater-search"
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-slate-200 bg-white pl-12 pr-28 py-3 text-sm sm:text-base outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0071DC]"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1.5">
          {value ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
              title="Clear"
            >
              <span>Clear</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex select-none rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">/</kbd>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Type to search. Press <span className="font-medium">/</span> to focus. Press <span className="font-medium">Enter</span> to search.
      </div>
    </div>
  );
}
