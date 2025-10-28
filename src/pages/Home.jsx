// src/pages/Home.jsx
// Clean version: No white frame, no padding, pure edge-to-edge landscape poster hero.

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

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
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
        <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </div>
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
function LandscapeCarousel({
  images = [
    { webp: "/Poster1_land.webp", jpg: "/Poster1_land.jpg", title: "Poster 1" },
    { webp: "/Poster2_land.webp", jpg: "/Poster2_land.jpg", title: "Poster 2" },
    { webp: "/Poster3_land.webp", jpg: "/Poster3_land.jpg", title: "Poster 3" },
    { webp: "/Poster4_land.webp", jpg: "/Poster4_land.jpg", title: "Poster 4" },
  ],
  interval = 3200,
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
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + length) % length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % length);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      stopTimer();
      window.removeEventListener("keydown", handleKey);
    };
  }, [length]);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!hoveringRef.current && !touchingRef.current) {
        setIndex((i) => (i + 1) % length);
      }
    }, interval);
  };
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const onMouseEnter = () => {
    hoveringRef.current = true;
  };
  const onMouseLeave = () => {
    hoveringRef.current = false;
  };

  // swipe support
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;
    let moved = false;

    const onTouchStart = (e) => {
      touchingRef.current = true;
      hoveringRef.current = true;
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
      const endX = e.changedTouches?.[0]?.clientX || 0;
      const dx = endX - startX;
      if (dx < -40) setIndex((i) => (i + 1) % length);
      else if (dx > 40) setIndex((i) => (i - 1 + length) % length);
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

  return (
    <div
      ref={rootRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="relative w-full h-full overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Featured posters"
    >
      <div style={trackStyle}>
        {images.map((img, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full relative">
            <picture>
              {img.webp && <source srcSet={img.webp} type="image/webp" />}
              <img
                src={img.jpg}
                alt={img.title}
                className="w-full h-full object-cover object-center"
                draggable={false}
              />
            </picture>
          </div>
        ))}
      </div>

      {/* navigation */}
      <div className="absolute left-1/2 bottom-4 transform -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-8 h-1.5 rounded-full transition-all duration-200 ${
              i === index ? "bg-white/90" : "bg-white/30"
            }`}
          />
        ))}
      </div>
      <button
        onClick={() => setIndex((i) => (i - 1 + length) % length)}
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/45 text-white rounded-full p-2"
      >
        ‹
      </button>
      <button
        onClick={() => setIndex((i) => (i + 1) % length)}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/45 text-white rounded-full p-2"
      >
        ›
      </button>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */
export default function Home() {
  const HEADER_H = 64;
  const carouselImages = [
    { webp: "/Poster1_land.webp", jpg: "/Poster1_land.jpg", title: "The Epic Adventure" },
    { webp: "/Poster2_land.webp", jpg: "/Poster2_land.jpg", title: "Mystery of the Night" },
    { webp: "/Poster3_land.webp", jpg: "/Poster3_land.jpg", title: "Summer Heist" },
    { webp: "/Poster4_land.webp", jpg: "/Poster4_land.jpg", title: "Legends Rise" },
  ];

  return (
    <main className="bg-slate-50 text-slate-900">
      <section
        className="relative overflow-hidden w-screen [margin-inline:calc(50%-50vw)]"
        style={{ height: `calc(100vh - ${HEADER_H}px)` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(110deg,#0071DC_0%,#0654BA_55%,#003F8E_100%)]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Grid layout */}
        <div className="relative z-10 h-full">
          <div
            className="h-full max-w-7xl mx-auto px-6 md:px-12 grid items-center gap-8"
            style={{ gridTemplateColumns: "minmax(320px, 440px) 1fr" }}
          >
            {/* Left content */}
            <div className="text-white relative z-30">
              <h1 className="mt-3 text-[2.3rem] md:text-6xl lg:text-7xl font-extrabold leading-[1.05] drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                Book Movies,{" "}
                <span className="underline decoration-4 decoration-[#FFC220] underline-offset-8">
                  Your-Style
                </span>
              </h1>

              <p className="mt-4 md:mt-6 text-base md:text-xl text-white/95 leading-relaxed max-w-lg">
                Search titles, pick a city and date, lock seats in real-time, and pay securely.
                Admins manage theaters, screens, shows, and pricing with clean, robust controls.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <PrimaryBtn as={Link} to="/movies">
                  Browse Movies <IconArrow className="w-5 h-5" />
                </PrimaryBtn>
                <GhostBtn as={Link} to="/showtimes">
                  Quick Showtimes
                </GhostBtn>
              </div>
            </div>
            <div />
          </div>
        </div>

        {/* Poster — edge-to-edge clean */}
        <div className="hidden md:block">
          <div
            className="absolute top-1/2 right-0 -translate-y-1/2 z-20"
            style={{
              width: "min(70vw,1200px)",
              maxWidth: "1200px",
            }}
          >
            <div className="relative overflow-hidden rounded-2xl">
              <LandscapeCarousel images={carouselImages} interval={3200} />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access below */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
