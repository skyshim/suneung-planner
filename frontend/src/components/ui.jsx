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
      <div className="text-[15px] font-bold tabnum mt-0.5 leading-tight" style={{ wordBreak: "keep-all" }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] tabnum mt-0.5 leading-tight" style={{ color: "var(--text-secondary)", wordBreak: "keep-all" }}>
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
          <path d="M5 12.5 10 17.5 19 7" stroke="var(--on-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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

/** 할 일 이름. 제목에 붙은 세부 내용(예: "어나클 · 파트2 41~60p")까지 보여준다. */
export function taskLabel(t) {
  const stripped = (t.title || "").replace(/^\d+\/\d+\([^)]+\)\s*/, "");
  if (!t.item) return stripped;
  return stripped.startsWith(t.item) ? stripped : t.item;
}

/** 실모 점수 만점 (탐구 50점). */
export const SCORE_MAX = { 국어: 100, 수학: 100, 영어: 100, 물리: 50, 화학: 50 };

/** 이 할 일에 점수를 적을 과목들. 실모가 아니면 빈 배열. */
export function scoreSubjects(t) {
  if (t.type !== "모의고사" || t.extra) return [];
  if (t.subject === "전과목") return ["국어", "수학", "영어", "물리", "화학"];
  return SCORE_MAX[t.subject] ? [t.subject] : [];
}

/** 점수 입력칸 묶음. value: {국어: 88}, onChange(next) */
export function ScoreInputs({ subjects, value, onChange, compact = false }) {
  if (!subjects.length) return null;
  const v = value || {};
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>
        점수
      </span>
      {subjects.map((s) => (
        <label key={s} className="flex items-center gap-1">
          {subjects.length > 1 && (
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
              {s[0]}
            </span>
          )}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={SCORE_MAX[s]}
            className="num-input"
            style={{ width: compact ? 48 : 58 }}
            placeholder="–"
            value={v[s] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const n = raw === "" ? null : Math.min(SCORE_MAX[s], Math.max(0, Number(raw)));
              onChange({ ...v, [s]: n });
            }}
            aria-label={`${s} 점수 (${SCORE_MAX[s]}점 만점)`}
          />
          <span className="text-[10px] tabnum" style={{ color: "var(--text-muted)" }}>
            /{SCORE_MAX[s]}
          </span>
        </label>
      ))}
    </div>
  );
}
