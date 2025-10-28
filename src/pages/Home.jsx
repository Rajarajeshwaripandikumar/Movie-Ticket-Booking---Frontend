i want image as landscape poster style like 4k  and make letters go left little bit for landscape poster,the blue colour colm make small like image size because down side have some column so cant see once scroll only see so its not mostly fit/////// src/pages/Home.jsx — Walmart style hero with horizontal auto-sliding poster carousel
import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

/* ------------------------------- Inline Icons ------------------------------ */
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
const IconSpark = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3z" />
    <path d="M6 16l.7 2.2L9 19l-2.3.8L6 22l-.7-2.2L3 19l2.3-.8L6 16zM18 15l.7 2.2L21 18l-2.3.8L18 21l-.7-2.2L15 18l2.3-.8L18 15z" />
  </svg>
);
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

/* ------------------------------- Horizontal Carousel ------------------------ */
/*
  Place posters in public/ (e.g. /Poster1.jpg, /Poster2.jpg, ...)
  This carousel is horizontal, auto-advances, pauses on hover, and supports basic touch swipe.
*/
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

  // Touch swipe handling (basic)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;
    let moved = false;

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
      moved = false;
      hoverRef.current = true; // pause while touching
    };
    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 10) moved = true;
    };
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

  // prepare transform: translateX(-index * (100%))
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
      className={cx("relative w-[320px] h-[480px] lg:w-[380px] lg:h-[560px] overflow-hidden rounded-2xl shadow-sm", className)}
    >
      {/* track */}
      <div style={trackStyle}>
        {images.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full">
            <img src={src} alt={`Poster ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* overlays (same as original) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent rounded-2xl" />
      <div className="pointer-events-none absolute inset-0 border border-white/50 m-4 rounded-xl" />

      {/* indicators bottom center */}
      <div className="absolute left-1/2 bottom-4 transform -translate-x-1/2 flex gap-2 pointer-events-none">
        {images.map((_, i) => (
          <span key={i} className={`w-8 h-1.5 rounded-full transition-all duration-300 ${i === index ? "bg-white/90 scale-100" : "bg-white/40 scale-75"}`} />
        ))}
      </div>

      {/* simple prev/next buttons (optional) */}
      <button
        onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
        className="pointer-events-auto absolute left-2 top-1/2 transform -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
        aria-label="Previous poster"
        style={{ backdropFilter: "blur(4px)" }}
      >
        ‹
      </button>
      <button
        onClick={() => setIndex((i) => (i + 1) % images.length)}
        className="pointer-events-auto absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/45"
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
  const HEADER_H = 64; // adjust if your navbar height differs

  return (
    <main className="bg-slate-50 text-slate-900">
      {/* Hero */}
      <section
        className="relative overflow-hidden w-screen [margin-inline:calc(50%-50vw)]"
        style={{ height: `calc(100vh - ${HEADER_H}px)` }}
      >
        {/* Visual layers must NOT intercept clicks */}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,#0071DC_0%,#0654BA_55%,#003F8E_100%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 h-full">
          <div className="h-full max-w-7xl mx-auto px-6 md:px-12 flex items-center">
            {/* Left: text + buttons */}
            <div className="max-w-3xl text-white">
              <h1 className="mt-3 text-[2.3rem] md:text-6xl lg:text-7xl font-extrabold leading-[1.05] drop-shadow-[0_2px_0_rgba(0,0,0,0.2)]">
                Book Movies, <span className="underline decoration-4 decoration-[#FFC220] underline-offset-8">Your-Style</span>
              </h1>

              <p className="mt-4 md:mt-6 text-base md:text-xl text-white/95 leading-relaxed max-w-2xl">
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

            {/* Right side poster with HORIZONTAL carousel */}
            <div className="hidden md:block ml-auto relative">
              <Card className="relative overflow-hidden bg-white/10 border-white/30 backdrop-blur-sm shadow-sm" as="div">
                {/* Horizontal carousel component */}
                <div className="p-4">
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
              </Card>
            </div>
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

        {/* Secondary strip with compact badges */}
        <section className="pb-16">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">
                <IconSpark className="w-4 h-4 text-slate-800" />
              </span>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">Real-time Seat Locks</div>
                <div className="text-slate-600">No surprises at checkout.</div>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">
                <IconTicket className="w-4 h-4 text-slate-800" />
              </span>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">Instant E-Tickets</div>
                <div className="text-slate-600">Mail & wallet friendly.</div>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50">
                <IconClock className="w-4 h-4 text-slate-800" />
              </span>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">14-Day Window</div>
                <div className="text-slate-600">Plan ahead with ease.</div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
