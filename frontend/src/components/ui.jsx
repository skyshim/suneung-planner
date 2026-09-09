import React from "react";
import { fmtMin } from "../api";

export function subjectColor(s) {
  return `var(--s-${s || "기타"}, var(--s-기타))`;
}

export function SubjectChip({ subject, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${className}`}
      style={{ color: "var(--text-secondary)" }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: subjectColor(subject) }}
        aria-hidden="true"
      />
      {subject || "기타"}
    </span>
  );
}

export function Badge({ tone = "muted", children }) {
  const map = {
    muted: { bg: "var(--surface-2)", fg: "var(--text-secondary)", bd: "var(--border)" },
    warn: { bg: "transparent", fg: "var(--warn)", bd: "var(--warn)" },
    danger: { bg: "transparent", fg: "var(--danger)", bd: "var(--danger)" },
    good: { bg: "transparent", fg: "var(--good)", bd: "var(--good)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "transparent" },
  }[tone];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap"
      style={{ background: map.bg, color: map.fg, borderColor: map.bd }}
    >
      {children}
    </span>
  );
}

/** 진행률 바 — 트랙은 중립, 채움은 주체 색. 항상 직접 라벨과 함께 쓴다. */
export function ProgressBar({ ratio, color, height = 8, label }) {
  const pct = Math.min(100, Math.max(0, (ratio || 0) * 100));
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ background: "var(--surface-2)", height }}
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 4 : 0 }}
      />
    </div>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="card px-3 py-2.5 flex-1 min-w-0">
      <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[17px] font-bold tabnum mt-0.5 truncate">{value}</div>
      {sub && (
        <div className="text-[11px] tabnum mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Check({ checked, onChange, size = 26 }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={checked ? "완료 해제" : "완료 표시"}
      className="shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: checked ? "var(--good)" : "var(--border-strong)",
        background: checked ? "var(--good)" : "transparent",
      }}
    >
      {checked && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="card px-4 py-8 text-center">
      <div className="text-sm font-semibold">{title}</div>
      {hint && (
        <div className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Section({ title, right, children, tone }) {
  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <h2 className="text-[13px] font-bold tracking-tight" style={{ color: tone || "var(--text-secondary)" }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function minLabel(m) {
  return fmtMin(m);
}
