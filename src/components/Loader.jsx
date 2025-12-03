// src/components/Loader.jsx — Walmart Style (clean, rounded, blue accents)
import React from "react";

export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
      <div className="text-center space-y-5">
        {/* Walmart Spinner */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-14 h-14 border-4 border-slate-200 border-t-[#0071DC] rounded-full animate-spin shadow-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#0071DC] font-extrabold text-lg tracking-wide">
              W
            </span>
          </div>
        </div>

        {/* Loading Text */}
        <p className="text-slate-700 font-semibold text-base tracking-wide animate-pulse">
          {text}
        </p>

        {/* Accent underline shimmer */}
        <div className="mx-auto w-24 h-[3px] bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F] animate-[pulse_1.8s_ease-in-out_infinite] rounded-full opacity-80" />
      </div>
    </div>
  );
}
