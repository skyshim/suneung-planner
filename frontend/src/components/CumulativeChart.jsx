import React, { useMemo, useRef, useState } from "react";
import { fmtMin } from "../api";

/**
 * 계획 누적 vs 실제 누적 (분) — 한 축, 2 시리즈.
 * 시리즈 색: --series-1(계획) / --series-2(실제). 범례 + 끝점 직접 라벨 + 크로스헤어 툴팁.
 */
export default function CumulativeChart({ series, height = 190 }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 340;
  const H = height;
  const pad = { t: 14, r: 16, b: 20, l: 40 };

  const { pts, maxY, dates } = useMemo(() => {
    let cp = 0;
    let ca = 0;
    const rows = series.map((d) => {
      cp += d.plan_min;
      ca += d.actual_min;
      return { date: d.date, plan: cp, actual: ca };
    });
    return { pts: rows, maxY: Math.max(cp, ca, 60), dates: rows.map((r) => r.date) };
  }, [series]);

  if (!pts.length) return null;

  const x = (i) => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  const path = (key) => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  const ticks = [0, 0.5, 1].map((f) => Math.round(maxY * f));

  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * (W / r.width);
    const i = Math.round(((cx - pad.l) / (W - pad.l - pad.r)) * (pts.length - 1));
    setHover(Math.min(pts.length - 1, Math.max(0, i)));
  };

  const h = hover != null ? pts[hover] : null;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-1.5 px-0.5">
        <Legend color="var(--series-1)" label="계획 누적" />
        <Legend color="var(--series-2)" label="실제 누적" />
      </div>
      <div
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onTouchMove={onMove}
        style={{ touchAction: "pan-y" }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="계획 누적 대비 실제 누적 학습시간">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9" fill="var(--text-muted)">
                {Math.round(t / 60)}h
              </text>
            </g>
          ))}
          <path d={path("plan")} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path("actual")} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {h && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h.plan)} r="4" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(h.actual)} r="4" fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth="2" />
            </g>
          )}
          <text x={W - pad.r} y={y(pts.at(-1).plan) - 5} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--text-secondary)">
            {Math.round(pts.at(-1).plan / 60)}h
          </text>
          <text x={pad.l} y={H - 5} fontSize="9" fill="var(--text-muted)">
            {dates[0].slice(5).replace("-", "/")}
          </text>
          <text x={W - pad.r} y={H - 5} textAnchor="end" fontSize="9" fill="var(--text-muted)">
            {dates.at(-1).slice(5).replace("-", "/")}
          </text>
        </svg>
      </div>
      {h && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 card px-2.5 py-1.5 text-[11px] tabnum pointer-events-none"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,.18)" }}
        >
          <div className="font-bold mb-0.5">{h.date.slice(5).replace("-", "/")}</div>
          <div style={{ color: "var(--text-secondary)" }}>계획 {fmtMin(h.plan)}</div>
          <div style={{ color: "var(--text-secondary)" }}>실제 {fmtMin(h.actual)}</div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
      <span style={{ width: 12, height: 2, background: color, borderRadius: 2 }} aria-hidden="true" />
      {label}
    </span>
  );
}
