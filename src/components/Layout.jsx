// src/components/Layout.jsx — Walmart Style (clean, rounded, blue accents)
import React, { useEffect } from "react";

/**
 * Layout wrapper component for all admin pages.
 * Props:
 * - title: optional page title (sets document.title)
 * - rightSlot: optional React node rendered on the right side of the header
 * - maxWidth: Tailwind container width (e.g. "max-w-6xl")
 * - hideHeaderRow: if true, hide the top header row (Movie Admin + rightSlot)
 * - children: page content
 */
export default function Layout({
  title = "",
  rightSlot = null,
  maxWidth = "max-w-6xl",
  hideHeaderRow = false,
  children,
}) {
  useEffect(() => {
    // set a helpful document title when provided
    if (title) document.title = `${title} — Movie Admin`;
    else document.title = `Movie Admin`;
  }, [title]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header (brand + page title row) */}
      {!hideHeaderRow && (
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
          <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between`}>
            {/* Left Side (Brand + Page Title) */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0071DC] flex items-center justify-center text-white font-black shadow-sm">
                🎬
              </div>
              <div>
                <h1 className="text-base font-extrabold leading-tight">Movie Admin</h1>
                {title && <p className="text-xs text-slate-500">{title}</p>}
              </div>
            </div>

            {/* Right Side (Custom slot like notifications / user menu) */}
            <div className="flex items-center gap-3">{rightSlot}</div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={`flex-1 w-full mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 py-6`}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 text-sm text-slate-500 text-center`}>
          © {new Date().getFullYear()} Movie Booking Admin Dashboard
        </div>
      </footer>
    </div>
  );
}
