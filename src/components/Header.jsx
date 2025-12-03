// src/components/Header.jsx — Walmart Style (clean, rounded, blue-accented)
import React from "react";
import { Link } from "react-router-dom";
import BackButton from "./BackButton";
import Logo from "./Logo";
import { User, Menu } from "lucide-react";

export default function Header() {
  return (
    <header className="relative bg-white border-b border-slate-200 shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-4">
        {/* Back Button (left) */}
        <div className="flex items-center">
          <BackButton fallback="/movies" />
        </div>

        {/* Brand / Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 group transition-transform hover:scale-[1.02]"
        >
          <Logo className="h-8" textClass="text-xl font-extrabold text-[#0071DC]" />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right-side navigation */}
        <nav className="flex items-center gap-4">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-[#0071DC] transition-colors"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>

          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-[#0654BA] transition-colors"
          >
            Admin
          </Link>

          <button
            className="p-2 rounded-full border border-slate-300 bg-white hover:bg-[#0071DC] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </nav>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#0071DC] via-[#0654BA] to-[#003E9F]" />
    </header>
  );
}
