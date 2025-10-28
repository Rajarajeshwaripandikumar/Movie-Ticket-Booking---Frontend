// src/pages/Home.jsx
// Grid-based hero: fixed left column (headline) + flexible right column (bleeding landscape carousel)

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* ------------------------------- Inline Icons ------------------------------ */
const IconArrow = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);
const IconMovie = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8" cy="12" r="2.25" />
    <path d="M13.5 9.75h5M13.5 12h5M13.5 14.25h3.25" />
  </svg>
);
const IconClock = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5l3 1.5" />
  </svg>
);
const IconTicket = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8a2.5 2.5 0 0 0 0 5v3.5a2 2 0 0 0 2 2H18.5a2 2 0 0 0 2-2V13a2.5 2.5 0 0 0 0-5V4.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V8z" />
    <path d="M14.5 5.5v1.5M14.5 9v1.5M14.5 12.5V14M9.5 5.5v1.5M9.5 9v1.5M9.5 12.5V14" />
  </svg>
);

/* ------------------------------- UI Primitives ----------------------------- */
const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`} {...rest}>
    {children}
  </Tag>
);

function cx(...a) { return a.filter(Boolean).join(" "); }
const PrimaryBtn = ({ as: As = "button", to, href, className = "", children, ...props }) => (
  <As
    {...(to ? { to } : {})}
    {...(href ? { href } : {})}
    {...props}
    className={cx(
      "inline-flex items-center gap-3 rounded-full px-6 py-3 font-semibold text-white",
      "bg-[#0071DC] hover:bg-[#0654BA] focus-visible:outline-none",
      "focus-visible:ring-2 focus-visible:ring-[#0071DC] shadow-sm",
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
      "inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold",
      "text-white border border-white/80 hover:bg-white/10",
      className
    )}
  >
    {children}
  </As>
);

/* ------------------------------- Quick Card -------------------------------- */
const QuickCard = ({ title, desc, to, cta, Icon }) => (
  <Card className="p-5 transition-all duration-200 hover:shadow-md">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-md bg-slate-50 border border-slate-200">
        <Icon className="w-6 h-6 text-slate-800" />
      </div>
      <div className="flex-1">
        <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">{title}</div>
        <p className="text-sm text-slate-600 mt-1 leading-snug">{desc}</p>
      </div>
    </div>

    <div className="mt-4">
      <Link
        to={to}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-white bg-[#0071DC] hover:bg-[#0654BA]"
      >
        {cta}
        <IconArrow className="w-5 h-5" />
      </Link>
    </div>
  </Card>
);

/* ------------------------------- Carousel (landscape) ----------------------- */
/**
 * LandscapeCarousel improvements:
 * - fitMode: "cover" | "contain"
 * - objectPosition: control focal point (e.g. "center right")
 * - responsive aspect ratio for consistent layout across breakpoints
 */
function LandscapeCarousel({
  images = [
    { jpg: "/Poster1_land.jpg", title: "Poster 1" },
    { jpg: "/Poster2_land.jpg", title: "Poster 2" },
    { jpg: "/Poster3_land.jpg", title: "Poster 3" },
    { jpg: "/Poster4_land.jpg", title: "Poster 4" },
    { jpg: "/Poster5_land.jpg", title: "Poster 5" },
    { jpg: "/Poster6_land.jpg", title: "Poster 6" }
  ],
  interval = 3200,
  fitMode = "cover",           // default to cover for full-bleed look
  objectPosition = "center right",
}) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef(null);
  const timerRef = useRef(null);
  const hoveringRef = useRef(false);
  const touchingRef = useRef(false);
  const length = images.length;

  useEffect(() => {
    startTimer();
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") setIndex(i => (i - 1 + length) % length);
      if (e.key === "ArrowRight") setIndex(i => (i + 1) % length);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      stopTimer();
      window.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!hoveringRef.current && !touchingRef.current) {
        setIndex(i => (i + 1) % length);
      }
    }, interval);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const onMouseEnter = () => { hoveringRef.current = true; };
  const onMouseLeave = () => { hoveringRef.current = false; };

  // touch handlers for swipe
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;
    let moved = false;

    const onTouchStart = (e) => {
      touchingRef.current = true;
      hoveringRef.current = true; // pause autoplay
      startX = e.touches[0].clientX;
      moved = false;
    };
    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 10) moved = true;
    };
    const onTouchEnd = (e) => {
      touchingRef.current = false;
      hoveringRef.current = false;
      if (!moved) return;
      const endX = (e.changedTouches && e.changedTouches[0].clientX) || 0;
      const dx = endX - startX;
      if (dx < -40) setIndex(i => Math.min(length - 1, i + 1));
      else if (dx > 40) setIndex(i => Math.max(0, i - 1));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [length]);

  const trackStyle = {
    width: `${length * 100}%`,
    transform: `translateX(-${(index * 100) / length}%)`,
    transition: "transform 700ms cubic-bezier(.2,.9,.2,1)",
    display: "flex",
    height: "100%",
  };

  // Responsive aspect-ratio via Tailwind's arbitrary values:
  // small: ~16/10, md+: 16/9 to look more cinematic on large screens.
  const outerClass =
    "relative overflow-hidden rounded-2xl shadow-2xl w-full " +
    "aspect-[16/10] md:aspect-[16/9] lg:aspect-[16/9]";

  return (
    <div
      ref={rootRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={outerClass}
      aria-roledescription="carousel"
      aria-label="Featured posters"
    >
      {/* sliding track */}
      <div style={trackStyle}>
        {images.map((img, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full relative">
            <picture>
              <source srcSet={img.jpg} type="image/jpeg" />
              <img
                src={img.jpg}
                alt={img.title || `Poster ${i + 1}`}
                loading="lazy"
                draggable={false}
                className="w-full h-full"
                style={{
                  objectFit: fitMode,           // "cover" ensures full-bleed
                  objectPosition: objectPosition,
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              />
            </picture>

            <div className="pointer-events-none absolute left-6 bottom-6 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-md text-sm text-white/90">
              {img.title}
            </div>
          </div>
        ))}
      </div>

      {/* visual overlays (kept subtle) */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_10%_0%,rgba(255,255,255,0.05),transparent_55%)] rounded-2xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/12 to-transparent rounded-2xl" />
      </div>

      {/* indicators */}
      <div className="absolute left-1/2 bottom-4 transform -translate-x-1/2 flex gap-2 z-20">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-8 h-1.5 rounded-full transition-all duration-200 ${i === index ? "bg-white/90" : "bg-white/30"}`}
            style={{ pointerEvents: "auto" }}
          />
        ))}
      </div>

      <button
        onClick={() => setIndex((i) => (i - 1 + length) % length)}
        aria-label="Previous slide"
        className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
        style={{ backdropFilter: "blur(4px)" }}
      >‹</button>

      <button
        onClick={() => setIndex((i) => (i + 1) % length)}
        aria-label="Next slide"
        className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
        style={{ backdropFilter: "blur(4px)" }}
      >›</button>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */
export default function Home() {
  const HEADER_H = 64;

  // configure images used by the carousel (edit names to match your public/ files)
  // NOTE: ensure these files exist in public/ or your hosting setup.
  const carouselImages = [
    { jpg: "/Poster1_land.jpg", title: "Poster 1" },
    { jpg: "/Poster2_land.jpg", title: "Poster 2" },
    { jpg: "/Poster3_land.jpg", title: "Poster 3" },
    { jpg: "/Poster4_land.jpg", title: "Poster 4" },
    { jpg: "/Poster5_land.jpg", title: "Poster 5" },
    { jpg: "/Poster6_land.jpg", title: "Poster 6" },
  ];

  return (
    <main className="bg-slate-50 text-slate-900">
      {/* Hero */}
      <section
        className="relative overflow-hidden w-screen [margin-inline:calc(50%-50vw)]"
        style={{ height: `calc(100vh - ${HEADER_H}px)` }}
      >
        {/* Background gradient + grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,#0071DC_0%,#0654BA_55%,#003F8E_100%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Grid: left column fixed width, right flexible */}
        <div className="relative z-10 h-full">
          <div className="h-full max-w-7xl mx-auto px-6 md:px-12 grid items-center gap-8"
               style={{ gridTemplateColumns: "minmax(300px,420px) 1fr" }}>
            {/* Left: headline (fixed max width, high z so it sits above carousel) */}
            <div className="text-white relative z-30">
              <h1 className="mt-3 text-[2.3rem] md:text-6xl lg:text-7xl font-extrabold leading-[1.05] drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                Book Movies, <span className="underline decoration-4 decoration-[#FFC220] underline-offset-8">Your-Style</span>
              </h1>

              <p className="mt-4 md:mt-6 text-base md:text-xl text-white/95 leading-relaxed max-w-lg">
                Search titles, pick a city and date, lock seats in real-time, and pay securely.
                Admins manage theaters, screens, shows, and pricing with clean, robust controls.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <PrimaryBtn as={Link} to="/movies" className="!no-underline" aria-label="Browse Movies">
                  Browse Movies
                  <IconArrow className="w-5 h-5" />
                </PrimaryBtn>

                <GhostBtn as={Link} to="/showtimes" aria-label="Quick Showtimes">
                  Quick Showtimes
                </GhostBtn>
              </div>
            </div>

            {/* Right: empty flow column (carousel placed absolutely so it can bleed to the right edge) */}
            <div className="relative" />
          </div>
        </div>

        {/* ---- absolutely positioned carousel anchored to the section (not the centered container) ---- */}
        <div className="hidden md:block">
          <div
            className="absolute top-1/2 right-0 -translate-y-1/2 z-20 pointer-events-auto"
            style={{
              width: "min(65vw,1200px)",
              maxWidth: "1200px",
              paddingRight: "0",
            }}
          >
            {/* Card wrapper kept minimal & transparent so carousel bleeds to edges */}
            <Card className="relative overflow-hidden bg-transparent border-0 shadow-none rounded-2xl">
              {/* direct carousel (no inner padding) */}
              <LandscapeCarousel
                images={carouselImages}
                interval={3200}
                fitMode="cover"
                objectPosition="center right"
              />
            </Card>
          </div>
        </div>
      </section>

      {/* Main content below hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Quick Access */}
        <section className="py-10 md:py-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <QuickCard
            title="Movies"
            desc="Explore the full catalog and catch the latest releases with zero fuss."
            to="/movies"
            cta="Explore"
            Icon={IconMovie}
          />
          <QuickCard
            title="Showtimes"
            desc="Filter by city, date, and theater to land the perfect slot."
            to="/movies?tab=showtimes"
            cta="Find"
            Icon={IconClock}
          />
          <QuickCard
            title="My Bookings"
            desc="Check tickets, seat numbers, and receipts—everything in one place."
            to="/bookings"
            cta="Open"
            Icon={IconTicket}
          />
        </section>
      </div>
    </main>
  );
}
