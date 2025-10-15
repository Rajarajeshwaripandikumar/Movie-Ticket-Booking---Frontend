// src/components/GlobalBackBar.jsx — Walmart Style (clean, blue-accented)
import React from "react";
import BackButton from "./BackButton";
import { ArrowLeft } from "lucide-react";

export default function GlobalBackBar() {
  return (
    <header className="relative bg-white border-b border-slate-200 shadow-sm z-40">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Back Button */}
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-5 w-5 text-[#0071DC]" />
          <BackButton />
        </div>

        {/* Optional right side placeholder */}
        <div className="hidden sm:block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Navigation
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F]" />
    </header>
  );
}
