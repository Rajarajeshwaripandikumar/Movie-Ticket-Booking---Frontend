// src/components/BackButton.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Hide only on these EXACT paths
  const HIDE_EXACT = [
    "/",
    "/login",
    "/register",
    "/admin",
    "/admin/login",
    "/admin/register",
    "/forgot-password",
  ];

  // Hide on any path that STARTS WITH one of these prefixes (for tokenized routes, etc.)
  const HIDE_PREFIX = ["/reset-password/"];

  const shouldHide =
    HIDE_EXACT.includes(pathname) ||
    HIDE_PREFIX.some((p) => pathname.startsWith(p));

  if (shouldHide) return null;

  const handleBack = () => {
    const isAdmin = pathname.startsWith("/admin");
    const fallback = isAdmin ? "/admin" : "/";
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <button
      onClick={handleBack}
      type="button"
      title="Back"
      aria-label="Go back"
      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC]"
    >
      <ArrowLeft className="w-4 h-4 text-[#0071DC]" />
      <span>Back</span>
    </button>
  );
}
