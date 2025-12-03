// src/components/Logo.jsx
import React from "react";

/**
 * Usage:
 *   <Logo size={36} />                    // numeric (sets width/height attrs)
 *   <Logo className="w-9 h-9" />          // CSS sized
 *   <Logo className="w-24 h-auto" />      // responsive width, keep aspect
 *   <Logo size="100%" />                  // percentage is valid for SVG
 * Avoid: size="auto"  (invalid for SVG attributes)
 */
export default function Logo({ size = 36, className = "" }) {
  const stroke = "#0B61B3"; // deep blue
  const accent = "#FFC93C"; // warm yellow
  const soft = "#7BB0FF";   // lighter blue

  // Only apply width/height when they are valid for SVG attributes.
  // - number => ok
  // - "100%" => ok (percentage)
  // - anything else (e.g., "auto") => omit and rely on CSS classes
  const isNumber = typeof size === "number";
  const isPercent = typeof size === "string" && /^\d+(\.\d+)?%$/.test(size);
  const sizeAttrs = (isNumber || isPercent) ? { width: size, height: size } : {};

  return (
    <svg
      {...sizeAttrs}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0B61B3" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* connectors */}
      <g
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M10 38 L24 26 L34 34 L44 26 L54 38" strokeOpacity="0.9" />
        <path d="M34 34 L34 50" strokeOpacity="0.7" />
      </g>

      {/* nodes */}
      <g filter="url(#shadow)">
        {/* left circle */}
        <circle cx="10" cy="38" r="5.2" fill={soft} stroke={stroke} strokeWidth="1.3" />
        {/* upper squares */}
        <rect x="20" y="22" width="8" height="8" rx="2" fill="white" stroke={stroke} strokeWidth="1.3" />
        <rect x="30" y="30" width="8" height="8" rx="2" fill={accent} stroke={stroke} strokeWidth="1.3" />
        <rect x="40" y="22" width="8" height="8" rx="2" fill="white" stroke={stroke} strokeWidth="1.3" />
        {/* right circle */}
        <circle cx="54" cy="38" r="5.2" fill="white" stroke={stroke} strokeWidth="1.3" />
        {/* bottom node */}
        <rect x="30" y="46" width="8" height="8" rx="2" fill={soft} stroke={stroke} strokeWidth="1.3" />
      </g>
    </svg>
  );
}
