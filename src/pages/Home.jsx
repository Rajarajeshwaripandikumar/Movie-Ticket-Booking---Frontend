// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

/* ------------------------------- Inline Icons ------------------------------ */
const IconArrow = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
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

/* ------------------------------- Horizontal Carousel ------------------------ */
function HorizontalPosterCarousel({
  images = ["/Poster1.jpg", "/Poster2.jpg", "/Poster3.jpg", "/Poster4.jpg"],
  interval = 3000,
  className = ""
}) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const hoverRef = useRef(false);
  const rootRef = useRef(null);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!hoverRef.current) setIndex((i) => (i + 1) % images.length);
    }, interval);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = () => { hoverRef.current = true; };
  const handleMouseLeave = () => { hoverRef.current = false; };

  // touch handlers
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;
    let moved = false;
    const onTouchStart = (e) => { startX = e.touches[0].clientX; moved = false; hoverRef.current = true; };
    const onTouchMove = (e) => { const dx = e.touches[0].clientX - startX; if (Math.abs(dx) > 10) moved = true; };
    const onTouchEnd = (e) => {
      hoverRef.current = false;
      if (!moved) return;
      const endX = (e.changedTouches && e.changedTouches[0].clientX) || 0;
      const dx = endX - startX;
      if (dx < -40) setIndex((i) => Math.min(images.length - 1, i + 1));
      else if (dx > 40) setIndex((i) => Math.max(0, i - 1));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [images.length]);

  const trackStyle = {
    width: `${images.length * 100}%`,
    transform: `translateX(-${index * (100 / images.length)}%)`,
    transition: "transform 700ms cubic-bezier(.2,.9,.2,1)",
    display: "flex",
    height: "100%"
  };

  return (
    <div
      ref={rootRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cx("relative w-[420px] h-[600px] lg:w-[380px] lg:h-[660px] overflow-hidden rounded-2xl shadow-2xl", className)}
    >
      <div style={trackStyle}>
        {images.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full">
            {/* keep tall crop but centered so poster looks like vertical movie poster inside right card */}
            <img src={src} alt={`Poster ${i + 1}`} className="w-full h-full object-cover object-top" />
          </div>
        ))}
      </div>

      {/* overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent rounded-2xl" />
      <div className="pointer-events-none absolute inset-0 border border-white/30 m-4 rounded-xl" />

      {/* indicators */}
      <div className="absolute left-1/2 bottom-6 transform -translate-x-1/2 flex gap-2 pointer-events-none">
        {images.map((_, i) => (
          <span key={i} className={`w-8 h-1.5 rounded-full transition-all duration-300 ${i === index ? "bg-white/90" : "bg-white/40"}`} />
        ))}
      </div>

      {/* prev/next */}
      <button
        onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
        className="pointer-events-auto absolute left-3 top-1/2 transform -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
        aria-label="Previous poster"
        style={{ backdropFilter: "blur(4px)" }}
      >
        ‹
      </button>
      <button
        onClick={() => setIndex((i) => (i + 1) % images.length)}
        className="pointer-events-auto absolute right-3 top-1/2 transform -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
        aria-label="Next poster"
        style={{ backdropFilter: "blur(4px)" }}
      >
        ›
      </button>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */
export default function Home() {
  const HEADER_H = 64;

  return (
    <main className="bg-slate-50 text-slate-900">
      {/* Hero */}
      <section
        className="relative overflow-hidden w-screen [margin-inline:calc(50%-50vw)]"
        style={{ minHeight: `82vh` }} // tall hero but not full-screen to reveal below content
      >
        {/* blue background + subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(110deg,#0071DC 0%,#0654BA 55%,#003F8E 100%)" }} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            mixBlendMode: "overlay",
          }}
        />

        {/* Right poster (absolute so it hugs the right edge like your original) */}
        <div className="hidden lg:block absolute right-12 top-12 z-30">
          <div className="rounded-2xl p-3 bg-white/6 border border-white/20 shadow-2xl" style={{ transform: "translateX(12px)" }}>
            <HorizontalPosterCarousel
              images={[
                "/Poster1.jpg",
                "/Poster2.jpg",
                "/Poster3.jpg",
                "/Poster4.jpg",
              ]}
              interval={3000}
            />
          </div>
        </div>

        {/* Hero content container */}
        <div className="relative z-10 h-full">
          <div className="h-full max-w-7xl mx-auto px-6 md:px-12 flex items-center">
            {/* Left: text area - keep it narrow and positioned left like original */}
            <div className="max-w-2xl text-white">
              <h1 className="mt-3 text-[3.2rem] md:text-[5.6rem] lg:text-[6.6rem] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.18)]">
                <div className="block">Book Movies,</div>
                <div className="block">
                  <span className="text-[1.05em] font-extrabold">Your-</span>
                </div>
                <div className="block -mt-1">
                  <span className="inline-block border-b-4 border-[#FFC220] pb-1">Style</span>
                </div>
              </h1>

              <p className="mt-5 md:mt-6 text-sm md:text-lg text-white/95 leading-relaxed max-w-xl">
                Search titles, pick a city and date, lock seats in real-time, and pay securely.
                Admins manage theaters, screens, shows, and pricing with clean, robust controls.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryBtn as={Link} to="/movies" className="!no-underline" aria-label="Browse Movies">
                  Browse Movies
                  <IconArrow className="w-5 h-5" />
                </PrimaryBtn>

                <GhostBtn as={Link} to="/showtimes" aria-label="Quick Showtimes">
                  Quick Showtimes
                </GhostBtn>
              </div>
            </div>

            {/* spacing to allow poster to sit visually right — empty flex space */}
            <div className="flex-1" />
          </div>
        </div>
      </section>

      {/* content below hero; negative margin to tuck slightly under hero like original */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <section className="py-10 md:py-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Quick cards simplified for brevity */}
          <Card className="p-5 flex items-start gap-3">
            <div className="flex-1">
              <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">Movies</div>
              <p className="text-sm text-slate-600 mt-1 leading-snug">Explore the full catalog and catch the latest releases with zero fuss.</p>
            </div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">🍿</div>
          </Card>

          <Card className="p-5 flex items-start gap-3">
            <div className="flex-1">
              <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">Showtimes</div>
              <p className="text-sm text-slate-600 mt-1 leading-snug">Filter by city, date, and theater to land the perfect slot.</p>
            </div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">⏰</div>
          </Card>

          <Card className="p-5 flex items-start gap-3">
            <div className="flex-1">
              <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900">My Bookings</div>
              <p className="text-sm text-slate-600 mt-1 leading-snug">Check tickets, seat numbers, and receipts—everything in one place.</p>
            </div>
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">🎟️</div>
          </Card>
        </section>
      </div>
    </main>
  );
}
