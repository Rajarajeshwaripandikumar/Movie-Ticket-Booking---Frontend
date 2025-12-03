// src/components/Footer.jsx — Walmart Style (clean, rounded, blue accents)
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="relative bg-white border-t border-slate-200 shadow-sm text-slate-700 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Left: Logo + Tagline */}
        <div className="flex items-center gap-3">
          <Logo className="h-6" textClass="text-lg font-extrabold text-[#0071DC]" />
          <div className="hidden sm:block text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 font-extrabold text-slate-800">
              Cinema
            </span>
          </div>
        </div>

        {/* Right: Copyright */}
        <div className="text-sm font-medium tracking-wide text-slate-600 text-center md:text-right">
          © {new Date().getFullYear()}{" "}
          <span className="font-semibold text-[#0071DC]">Cinema by Site</span>. All rights reserved.
        </div>
      </div>

      {/* Blue accent bar */}
      <div className="absolute bottom-0 left-0 w-full h-[4px] bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F] rounded-t-full" />
    </footer>
  );
}
