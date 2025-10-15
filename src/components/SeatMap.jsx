import React, { useMemo } from "react";

/**
 * SeatMap — Walmart-style (clean, rounded, blue accents)
 * 1-based indexing for rows/cols
 *
 * Props:
 *  - rows, cols
 *  - seats: [{ row, col, status }]   // status: AVAILABLE | LOCKED | BOOKED
 *  - selected: [{ row, col }]
 *  - onToggle({ row, col, status })
 */
export default function SeatMap({ rows = 10, cols = 10, seats = [], selected = [], onToggle }) {
  /* Status map r-c -> STATUS */
  const seatMap = useMemo(() => {
    const map = new Map();
    (seats || []).forEach((s) => {
      const r = Number(s.row), c = Number(s.col);
      if (Number.isFinite(r) && Number.isFinite(c)) {
        map.set(`${r}-${c}`, String(s.status || "AVAILABLE").toUpperCase());
      }
    });
    return map;
  }, [seats]);

  const isSelected = (r, c) => selected.some((s) => s.row === r && s.col === c);

  // Single-letter labels (A, B, C…)
  const rowLabel = (r) => String.fromCharCode(64 + r);

  /* Walmart blues */
  const BLUE = "#0071DC";
  const BLUE_DEEP = "#0654BA";
  const BLUE_LIGHT = "#EAF3FF";

  const seatClass = (r, c) => {
    const status = seatMap.get(`${r}-${c}`) || "AVAILABLE";
    const active = isSelected(r, c);

    if (active)
      return "bg-[#0071DC] text-white border border-transparent shadow-sm scale-[1.02]";

    if (status === "BOOKED" || status === "LOCKED")
      return "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed";

    return "bg-white text-slate-800 border border-slate-300 hover:border-[#0654BA] hover:shadow-sm";
  };

  const disabledSeat = (r, c) => {
    const st = seatMap.get(`${r}-${c}`) || "AVAILABLE";
    return st === "BOOKED" || st === "LOCKED";
  };

  return (
    <div className="w-full">
      {/* SEAT GRID */}
      <div className="px-2 sm:px-4">
        <div className="inline-block">
          {Array.from({ length: rows }).map((_, rIdx) => {
            const r = rIdx + 1;
            return (
              <div key={`row-${r}`} className="flex items-center gap-3 py-1">
                {/* Row label (left) */}
                <div className="w-8 shrink-0 text-sm font-semibold text-slate-700 text-left">
                  {rowLabel(r)}
                </div>

                {/* Seats */}
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: cols }).map((__, cIdx) => {
                    const c = cIdx + 1;
                    const status = seatMap.get(`${r}-${c}`) || "AVAILABLE";
                    const disabled = disabledSeat(r, c);

                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => onToggle?.({ row: r, col: c, status })}
                        title={`${rowLabel(r)}${c} (${status})`}
                        className={`w-9 h-9 rounded-xl text-[11px] font-semibold flex items-center justify-center transition-all duration-150 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071DC] ${seatClass(
                          r,
                          c
                        )}`}
                        aria-label={`Seat ${rowLabel(r)}${c} ${status}`}
                      >
                        {disabled ? "×" : c}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* CURVED BLUE SCREEN */}
        <div className="mt-10 mb-1 flex justify-center">
          {/* layered bars for a subtle acrylic look in Walmart blues */}
          <div className="relative w-[340px] h-8">
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-[24px]"
              style={{
                width: 290,
                height: 10,
                top: 12,
                background: BLUE_LIGHT,
                filter: "blur(0.2px)",
                transform: "perspective(300px) rotateX(25deg)",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-[20px]"
              style={{
                width: 300,
                height: 12,
                top: 10,
                background: BLUE,
                opacity: 0.95,
                transform: "perspective(300px) rotateX(25deg)",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-[18px]"
              style={{
                width: 320,
                height: 12,
                top: 6,
                background: BLUE_LIGHT,
                opacity: 0.85,
                transform: "perspective(300px) rotateX(25deg)",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-[16px]"
              style={{
                width: 340,
                height: 12,
                top: 2,
                background: BLUE_DEEP,
                opacity: 0.9,
                transform: "perspective(300px) rotateX(25deg)",
              }}
            />
          </div>
        </div>

        {/* SCREEN THIS WAY */}
        <p className="text-center text-[11px] tracking-[0.2em] text-slate-500">
          SCREEN THIS WAY
        </p>

        {/* LEGEND */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm">
          <Legend boxClass="bg-white border border-slate-300" label="Available" />
          <Legend
            boxClass="bg-slate-100 border border-slate-200 grid place-items-center text-slate-400"
            label="Occupied"
            glyph="×"
          />
          <Legend boxClass="bg-[#0071DC] text-white" label="Selected" />
        </div>
      </div>
    </div>
  );
}

function Legend({ boxClass, label, glyph }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span
        className={`w-5 h-5 rounded-md text-[12px] ${boxClass}`}
        style={{ display: "inline-grid", placeItems: "center" }}
      >
        {glyph ?? ""}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
