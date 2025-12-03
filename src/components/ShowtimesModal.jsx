// src/components/ShowtimesModal.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import {
  X,
  Film,
  MapPin,
  Clock,
  Armchair,
  IndianRupee,
  Info,
  CalendarRange,
} from "lucide-react";

/* Lightweight inline placeholder */
const placeholder =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300'>
      <rect width='100%' height='100%' fill='#f3f4f6'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            fill='#9ca3af' font-size='18' font-family='Arial'>No poster</text>
    </svg>`
  );

function resolvePoster(theater) {
  const raw =
    theater?.imageUrl ||
    theater?.poster ||
    theater?.image ||
    theater?.thumbnail ||
    "";
  if (!raw) return placeholder;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const root = base.replace(/\/api$/i, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${root}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

function toDateTimeLabel(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeShowtime(s = {}) {
  const id = s._id || s.id;
  const start =
    s.startTime || s.time || s.startsAt || s.date || s.showtime || s.start;
  const movieTitle = s.movie?.title || s.movie?.name || s.title || "Untitled";
  const screenName = s.screen?.name || s.screen || "Screen";
  const city = s.theater?.city || s.city || s.location || "";
  const price = Number.isFinite(+s.basePrice)
    ? +s.basePrice
    : Number.isFinite(+s.price)
    ? +s.price
    : null;
  const language =
    s.language ||
    (Array.isArray(s.languages) ? s.languages.join(", ") : s.languages) ||
    s.movie?.language ||
    "";
  const seatsLeft = s.seatsLeft ?? s.availableSeats ?? s.remaining ?? s.left ?? null;

  return { id, start, movieTitle, screenName, city, price, language, seatsLeft, raw: s };
}

export default function ShowtimesModal({ theater, onClose }) {
  const navigate = useNavigate();
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(false);

  const poster = useMemo(() => resolvePoster(theater), [theater]);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!theater) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        if (Array.isArray(theater?.showtimes) && theater.showtimes.length) {
          if (mounted) setShowtimes(theater.showtimes);
        } else {
          try {
            const id = theater._id || theater.id;
            const res = await api.get(`/api/theaters/${id}`);
            const data = res?.data;
            const list =
              data?.showtimes ??
              data?.theater?.showtimes ??
              data?.theaters?.[0]?.showtimes ??
              [];
            if (mounted) setShowtimes(Array.isArray(list) ? list : []);
          } catch {
            if (mounted) setShowtimes([]);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [theater]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!theater) return null;

  const normalized = showtimes.map(normalizeShowtime);

  const handleBook = (st) => {
    if (!st?.id) return;
    onClose?.();
    navigate(`/seats/${st.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-[#F7FAFF] to-white">
          <div className="space-y-0.5">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Film className="h-4 w-4 text-[#0071DC]" />
              {theater?.name || "Theater"}
            </h3>
            <div className="text-xs text-slate-600 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {theater?.address || "—"}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5" />
                {theater?.city || "—"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
            aria-label="Close"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 max-h-[70vh] overflow-auto">
          {/* Poster */}
          <div className="hidden sm:block">
            <img
              src={poster || placeholder}
              alt={theater?.name || "Poster"}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = placeholder;
              }}
              className="w-full h-64 object-cover rounded-xl border border-slate-200"
            />
          </div>

          {/* Showtimes list */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Available showtimes</h4>

            {loading ? (
              <div className="text-center py-10 text-sm text-slate-500">Loading…</div>
            ) : normalized.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">No showtimes available.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {normalized.map((s) => (
                  <div
                    key={s.id || `${s.start}-${s.screenName}`}
                    className="flex items-start justify-between rounded-xl border border-slate-200 p-3 hover:shadow-sm transition"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {s.movieTitle}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        {toDateTimeLabel(s.start)}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <Armchair className="h-3.5 w-3.5" />
                        {s.screenName}
                        {typeof s.seatsLeft === "number" && (
                          <span className="ml-2 text-emerald-700 font-medium">
                            • {s.seatsLeft} seats left
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {Number.isFinite(s.price) ? `₹${s.price}` : "—"}
                        {s.language ? <span className="ml-2">• {s.language}</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 pl-3">
                      <button
                        onClick={() => handleBook(s)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold
                                   text-white bg-[#0071DC] hover:bg-[#0654BA]
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]
                                   transition"
                      >
                        Book
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          // optionally navigate to a details route
                          // navigate(`/showtimes/${s.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:underline"
                        title="More details"
                      >
                        <Info className="h-3.5 w-3.5" />
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 text-right bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
          >
            Close
          </button>
        </div>

        {/* Bottom accent bar */}
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F]" />
      </div>
    </div>
  );
}
