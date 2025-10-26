// src/pages/TheatersPage.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";
import Logo from "../components/Logo";
import TheaterCard from "../components/TheaterCard";

/* ✅ Master amenities list (always show all 7) */
const MASTER_AMENITIES = ["Parking", "Snacks", "AC", "Wheelchair", "3D", "IMAX", "Dolby Atmos"];

/* --------------------------- Walmart primitives --------------------------- */
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

export default function TheatersPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  /* ------------------------------ State ------------------------------ */
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [amenityFilter, setAmenityFilter] = useState("All");

  const [theaters, setTheaters] = useState([]);
  const [cities, setCities] = useState(["All"]);
  const [amenities, setAmenities] = useState(["All", ...MASTER_AMENITIES]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ------------------------------ Helpers ------------------------------ */

  // Build full image URL when API returns relative paths
  const apiBase = useMemo(() => {
    try {
      const u = new URL(api?.defaults?.baseURL || window.location.origin);
      return u.origin;
    } catch {
      return window.location.origin;
    }
  }, []);

  const resolveImageUrl = (t) => {
    const raw = t?.imageUrl || t?.posterUrl || t?.poster || t?.image || t?.theaterImage || "";
    if (!raw) return "/no-image.png";
    const full = /^https?:\/\//i.test(raw) ? raw : `${apiBase}${raw.startsWith("/") ? "" : "/"}${raw}`;
    const v = t?.updatedAt ? new Date(t.updatedAt).getTime() : null;
    return v ? `${full}${full.includes("?") ? "&" : "?"}v=${v}` : full;
  };

  // Normalize amenities: array|string, also handle 'amentities' typo
  const normalizeTheater = (t) => {
    let rawAmenities =
      Array.isArray(t?.amenities)
        ? t.amenities
        : Array.isArray(t?.amentities)
        ? t.amentities
        : typeof t?.amenities === "string"
        ? t.amenities
        : typeof t?.amentities === "string"
        ? t.amentities
        : [];

    // rawAmenities might be a JSON string like '["AC","Parking"]' — handle that
    if (typeof rawAmenities === "string") {
      const s = rawAmenities.trim();
      if (s.startsWith("[") && s.endsWith("]")) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) rawAmenities = parsed;
        } catch {
          // fallback to comma-split
          rawAmenities = s.split(",").map((x) => x.trim());
        }
      } else {
        rawAmenities = s.split(",").map((x) => x.trim());
      }
    }

    const normAmenities = Array.from(new Set((rawAmenities || []).map((a) => String(a || "").trim()).filter(Boolean)));
    return { ...t, amenities: normAmenities, imageUrl: resolveImageUrl(t) };
  };

  // 🔎 Apply client-side filters (fallback if backend ignores them)
  const applyFilters = (items) => {
    const q = norm(query);
    const cityN = norm(cityFilter);
    const amenN = norm(amenityFilter);

    return items.filter((t) => {
      const tCity = norm(t.city);
      const tName = norm(t.name || t.title);
      const tAmenities = (t.amenities || []).map(norm);

      const matchesQuery = !q || tName.includes(q) || tCity.includes(q);
      const matchesCity = cityFilter === "All" || tCity === cityN;
      const matchesAmenity = amenityFilter === "All" || tAmenities.includes(amenN);

      return matchesQuery && matchesCity && matchesAmenity;
    });
  };

  const setUrlParams = (overrides = {}) => {
    const sp = new URLSearchParams(search);
    const next = {
      q: query || "",
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

  /* ------------------------------ Keep cityFilter valid when cities change ------------------------------ */
  useEffect(() => {
    if (!cities || cities.length === 0) return;
    if (cityFilter && cityFilter !== "All") {
      const found = cities.some((c) => String(c).trim().toLowerCase() === String(cityFilter).trim().toLowerCase());
      if (!found) {
        // Reset to All and update URL (use setTimeout to avoid React warning in render cycle)
        setTimeout(() => {
          setCityFilter("All");
          setUrlParams();
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  /* ------------------------------ URL → State ------------------------------ */
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const q = sp.get("q");
    const city = sp.get("city");
    const amen = sp.get("amenity");

    if (q !== null) setQuery(q);
    if (city !== null && city.trim()) setCityFilter(city);
    if (amen !== null && amen.trim()) setAmenityFilter(amen);

    setPage(1);
  }, [search]);

  /* ------------------------------ Data load ------------------------------ */
  useEffect(() => {
    loadTheaters({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cityFilter, amenityFilter]);

  async function loadTheaters({ reset = false } = {}) {
    setLoading(true);
    setError("");
    try {
      const resp = await api.get("/theaters", {
        params: {
          q: query || undefined,
          city: cityFilter === "All" ? undefined : cityFilter,
          amenity: amenityFilter === "All" ? undefined : amenityFilter,
          page: reset ? 1 : page,
          limit: 12, // denser grid
          ts: Date.now(), // cache buster
        },
      });

      // --- DEBUG: inspect API response so we can see amenities shape ---
      console.debug("API response /theaters:", resp?.data);

      const fetched = resp?.data?.theaters ?? resp?.data ?? [];
      const normalized = Array.isArray(fetched) ? fetched.map(normalizeTheater) : [];

      // ✅ Apply client-side filters so selecting an amenity hides other theaters
      const filtered = applyFilters(normalized);

      // 🔁 Merge & update cities + amenities lists from API (but always keep MASTER_AMENITIES)
      if (reset) {
        // build an array, sort, then dedupe
        const cityArr = normalized
          .map((t) => (t.city || "").trim())
          .filter(Boolean)
          .map((c) => String(c))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

        const uniqueCities = Array.from(new Set(cityArr));
        setCities(["All", ...uniqueCities]);

        const amenSet = new Set(MASTER_AMENITIES);
        normalized.forEach((t) => (t.amenities || []).forEach((a) => a && amenSet.add(String(a).trim())));
        setAmenities(["All", ...Array.from(amenSet)]);
      }

      if (reset) {
        setTheaters(filtered);
        setPage(2);
      } else {
        setTheaters((s) => [...s, ...filtered]);
        setPage((p) => p + 1);
      }

      const apiHasMore = typeof resp?.data?.hasMore === "boolean" ? resp.data.hasMore : null;
      setHasMore(apiHasMore ?? (Array.isArray(fetched) && fetched.length > 0));

      // Keep URL synced
      setUrlParams();
    } catch (e) {
      console.error("❌ Failed to load theaters:", e);
      setError("Unable to load theaters. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

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

  /* ------------------------------ Navigation ------------------------------ */
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
      const { data } = await api.get(`/theaters/${t._id}/screens`);
      const screens = Array.isArray(data?.data) ? data.data : [];
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

  /* ------------------------------ Render ------------------------------ */
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Main Section */}
      <section className="max-w-7xl mx-auto px-6 mt-8">
        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1">
              <SearchBarTheaters
                value={query}
                onChange={setQuery}
                onClear={() => setQuery("")}
                onSubmit={() => loadTheaters({ reset: true })}
                placeholder="Search by theater name or city"
              />
            </div>

            <div className="flex gap-3 items-center">
              {/* City Filter */}
              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full bg-white px-4 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
                  <select
                    value={cityFilter}
                    onChange={(e) => {
                      // clear current list visually to avoid mixing old + new while new fetch runs
                      setTheaters([]);
                      setCityFilter(e.target.value || "All");
                      // load handled by useEffect (it listens to cityFilter)
                    }}
                    className="bg-transparent outline-none text-sm w-full min-w-[120px]"
                    aria-label="Filter by city"
                  >
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c === "All" ? "All Cities" : c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amenity Filter */}
              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 border border-slate-300 rounded-full bg-white px-4 py-2 focus-within:ring-2 focus-within:ring-[#0071DC]">
                  <select
                    value={amenityFilter}
                    onChange={(e) => {
                      setTheaters([]);
                      setAmenityFilter(e.target.value || "All");
                    }}
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

              {/* Search button */}
              <PrimaryBtn onClick={() => loadTheaters({ reset: true })} className="text-sm">
                Search
              </PrimaryBtn>
            </div>
          </div>

          {/* Quick Refresh under filters */}
          <div className="mt-4 flex justify-end">
            <GhostBtn onClick={() => loadTheaters({ reset: true })} className="text-sm">
              Refresh
            </GhostBtn>
          </div>
        </Card>

        {/* Loading */}
        {loading && theaters.length === 0 && (
          <div className="text-center py-12 text-slate-600">Loading theaters...</div>
        )}

        {/* Error */}
        {error && !loading && <div className="text-center py-8 text-rose-600 font-medium">{error}</div>}

        {/* Grid */}
        {!loading && !error && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {theaters.length === 0 ? (
              <div className="col-span-full flex justify-center py-12">
                <Card className="px-10 py-12 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-14 h-14 text-slate-400 mb-4 mx-auto"
                  >
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
                    // NOTE: we keep amenities on the theater object for detail pages
                  }}
                />
              ))
            )}
          </div>
        )}

        {/* Load More */}
        {!error && theaters.length > 0 && hasMore && (
          <div className="mt-8 flex justify-center">
            <GhostBtn onClick={() => loadTheaters({ reset: false })} className="px-5">
              {loading ? "Loading…" : "Load More"}
            </GhostBtn>
          </div>
        )}
      </section>

      {/* Simple list beneath for admin-like view showing master amenities per theater
          Only show when no filters/search active — avoids confusing filtered UI */}
      {!query && cityFilter === "All" && amenityFilter === "All" && (
        <section className="max-w-7xl mx-auto px-6 mt-10">
          <Card className="p-5">
            <h3 className="text-lg font-extrabold mb-4">All Theaters (Amenities overview)</h3>
            <div className="space-y-3">
              {theaters.map((t) => (
                <div key={t._id || t.id} className="flex items-center justify-between gap-4 p-3 border rounded-2xl">
                  <div className="flex items-center gap-3">
                    <img src={t.imageUrl || "/no-image.png"} alt={t.name} className="w-12 h-12 rounded-xl object-cover border" />
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-slate-600">{t.city}</div>
                    </div>
                  </div>

                  {/* Amenities: always show MASTER_AMENITIES and mark present ones */}
                  <div className="flex-1 px-4">
                    <div className="flex flex-wrap gap-2">
                      {MASTER_AMENITIES.map((m) => {
                        const present = (t.amenities || []).map((x) => String(x).trim().toLowerCase()).includes(m.toLowerCase());
                        return (
                          <span
                            key={m}
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${
                              present ? "bg-[#0071DC] text-white border-[#0071DC]" : "bg-white text-slate-500 border-slate-200"
                            }`}
                            title={present ? `${m} — available` : `${m} — not available`}
                          >
                            {m}
                          </span>
                        );
                      })}

                      {/* Extra amenities (not in MASTER_AMENITIES) */}
                      {(t.amenities || [])
                        .map((a) => String(a).trim())
                        .filter(Boolean)
                        .filter((a) => !MASTER_AMENITIES.map((x) => x.toLowerCase()).includes(a.toLowerCase()))
                        .slice(0, 6) // safety cap
                        .map((extra) => (
                          <span key={extra} className="text-[11px] px-2 py-0.5 rounded-full border bg-white text-slate-700 border-slate-200">
                            {extra}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <PrimaryBtn onClick={() => handleViewShowtimes(t)} className="px-3 py-1 text-sm">
                      View showtimes
                    </PrimaryBtn>
                    <GhostBtn onClick={() => handleViewFirstScreen(t)} className="px-3 py-1 text-sm">
                      Open screen
                    </GhostBtn>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}

/* ------------------------------ Search Bar (Walmart style) ------------------------------ */
function SearchBarTheaters({ value, onChange, onClear, onSubmit, placeholder = "Search" }) {
  const inputRef = useRef(null);

  // Focus with "/" key (if not in input/textarea)
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
        {/* Left icon */}
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

        {/* Right actions: clear + hint */}
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
            <kbd className="hidden sm:inline-flex select-none rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
              /
            </kbd>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Type to search. Press <span className="font-medium">/</span> to focus. Press{" "}
        <span className="font-medium">Enter</span> to search.
      </div>
    </div>
  );
}
