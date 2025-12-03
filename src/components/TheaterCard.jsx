// src/components/TheaterCard.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { MapPin, ChevronRight, ScreenShare, Building2 } from "lucide-react";

/* --------------------------- Walmart primitives --------------------------- */
const Card = ({ className = "", children, as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

const Pill = ({ className = "", children, ...rest }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-700 ${className}`}
    {...rest}
  >
    {children}
  </span>
);

const GhostIconBtn = ({ className = "", children, ...rest }) => (
  <button
    className={`inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const PrimaryBtn = ({ className = "", children, ...rest }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

const SecondaryBtn = ({ className = "", children, ...rest }) => (
  <button
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold border border-slate-300 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] disabled:opacity-60 ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/* ------------------------- Image Builder ------------------------- */
function buildPosterSrc(theater) {
  const rawPoster =
    theater?.imageUrl ||
    theater?.posterUrl ||
    theater?.poster ||
    theater?.image ||
    theater?.theaterImage ||
    "";
  if (!rawPoster) return "/no-image.png";
  const absolute = /^https?:\/\//i.test(rawPoster);
  const path = absolute
    ? rawPoster
    : `${window.location.origin}${rawPoster.startsWith("/") ? "" : "/"}${rawPoster}`;
  const v = theater?.updatedAt ? new Date(theater.updatedAt).getTime() : null;
  return v ? `${path}${path.includes("?") ? "&" : "?"}v=${v}` : path;
}

/* ------------------------ Amenities Helper ------------------------ */
function normalizeAmenities(t) {
  let raw = Array.isArray(t?.amenities)
    ? t.amenities
    : Array.isArray(t?.amentities)
    ? t.amentities
    : typeof t?.amenities === "string"
    ? t.amenities.split(",")
    : typeof t?.amentities === "string"
    ? t.amentities.split(",")
    : [];
  return Array.from(new Set(raw.map((x) => String(x).trim()).filter(Boolean)));
}

const asNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export default React.memo(function TheaterCard({ theater, onViewShowtimes }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [screens, setScreens] = useState([]);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [errorScreens, setErrorScreens] = useState("");

  const posterSrc = useMemo(() => buildPosterSrc(theater), [theater]);
  const amenities = useMemo(() => normalizeAmenities(theater), [theater]);
  const top = amenities.slice(0, 2);

  const hasMapData = Boolean(theater?.city && theater?.address);
  const theaterId = theater?._id || theater?.id;
  const city = theater?.city || "";

  const screensCount = useMemo(() => {
    if (Number.isFinite(asNum(theater?.screensCount))) return Math.max(0, asNum(theater.screensCount));
    if (Number.isFinite(asNum(theater?.screenCount))) return Math.max(0, asNum(theater.screenCount));
    if (Array.isArray(theater?.screens)) return theater.screens.length;
    if (theater?.screens != null && !isNaN(Number(theater.screens))) return Math.max(0, Number(theater.screens));
    return 0;
  }, [theater]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /* ------------------------ Navigation ------------------------ */
  const handleViewShowtimes = useCallback(() => {
    if (typeof onViewShowtimes === "function") {
      onViewShowtimes();
      return;
    }
    if (!theaterId) return;
    navigate(`/showtimes?theaterId=${theaterId}&date=${today}`, {
      state: { theaterId, date: today, city },
    });
  }, [onViewShowtimes, theaterId, city, navigate, today]);

  /* ------------------------ Screen Picker ------------------------ */
  const loadScreens = useCallback(async () => {
    if (!theaterId || screensCount === 0) return;
    setPickerOpen(true);
    setLoadingScreens(true);
    setErrorScreens("");
    try {
      const { data } = await api.get(`/theaters/${theaterId}/screens`, { params: { ts: Date.now() } });
      setScreens(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setErrorScreens(e?.response?.data?.error || "Failed to load screens");
    } finally {
      setLoadingScreens(false);
    }
  }, [theaterId, screensCount]);

  const goToScreenShowtimes = useCallback(
    (screenId) => {
      if (!theaterId || !screenId) return;
      navigate(`/theaters/${theaterId}/screens/${screenId}/showtimes`, {
        state: { theaterId, screenId, city },
      });
    },
    [theaterId, city, navigate]
  );

  return (
    <Card className="p-2 hover:shadow-md transition-shadow">
      {/* Poster */}
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <img
          src={posterSrc}
          alt={`${theater?.name || "Theater"} poster`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            if (!e.currentTarget.src.endsWith("/no-image.png")) {
              e.currentTarget.src = "/no-image.png";
            }
            setLoaded(true);
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      {/* Info */}
      <div className="mt-3 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold leading-snug line-clamp-1 text-slate-900 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-[#0654BA]" />
              <span className="truncate">{theater?.name || "Unnamed Theater"}</span>
            </h4>
            <p className="mt-0.5 text-[12px] text-slate-600 line-clamp-1">
              {theater?.address || "No address"} {theater?.city ? `• ${theater.city}` : ""}
            </p>
          </div>

          {hasMapData && (
            <GhostIconBtn
              as="a"
              title="View on map"
              aria-label="View on map"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${theater.address}, ${theater.city}`)}`, "_blank", "noreferrer")}
            >
              <MapPin className="w-4 h-4 text-[#0071DC]" />
            </GhostIconBtn>
          )}
        </div>

        {/* Screens pill */}
        <div className="mt-1 flex items-center gap-1">
          <SecondaryBtn
            type="button"
            onClick={loadScreens}
            disabled={!theaterId || screensCount === 0}
            title={!theaterId ? "Theater ID missing" : screensCount === 0 ? "No screens yet" : "Select a screen"}
            aria-disabled={!theaterId || screensCount === 0}
            className="text-[11px] px-2.5 py-1"
          >
            <ScreenShare className="h-3.5 w-3.5" />
            {screensCount === 0 ? "No screens" : `${screensCount} ${screensCount === 1 ? "screen" : "screens"}`}
          </SecondaryBtn>
        </div>

        {/* Amenities (top 2) */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {top.length ? (
            top.map((a) => (
              <Pill key={a} className="bg-white">
                {a}
              </Pill>
            ))
          ) : (
            <span className="text-slate-400 text-[11px] italic">No amenities</span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-3">
          <PrimaryBtn type="button" onClick={handleViewShowtimes} disabled={!theaterId} className="text-[12px]">
            View showtimes
            <ChevronRight className="w-4 h-4" />
          </PrimaryBtn>
        </div>
      </div>

      {/* Screen Picker */}
      {pickerOpen && (
        <Card className="mt-3 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-[12px] text-slate-800">Select a screen</p>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-[12px] text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] rounded-md px-1"
            >
              Close
            </button>
          </div>

          {loadingScreens ? (
            <p className="text-[12px] text-slate-600">Loading screens…</p>
          ) : errorScreens ? (
            <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1">{errorScreens}</p>
          ) : screens.length === 0 ? (
            <p className="text-[12px] text-slate-600">No screens found.</p>
          ) : (
            <ul className="space-y-1.5">
              {screens.map((s) => (
                <li key={s._id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2">
                  <p className="font-semibold text-[12px] text-slate-800">
                    {s.name || `Screen`}
                    {Number.isFinite(asNum(s.rows)) && Number.isFinite(asNum(s.columns)) && (
                      <span className="ml-1 text-[11px] text-slate-500">
                        · {asNum(s.rows)}×{asNum(s.columns)}
                      </span>
                    )}
                  </p>
                  <SecondaryBtn
                    type="button"
                    onClick={() => goToScreenShowtimes(s._id)}
                    className="text-[11px] px-2.5 py-1"
                  >
                    Showtimes <ChevronRight className="h-3.5 w-3.5" />
                  </SecondaryBtn>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Card>
  );
});
