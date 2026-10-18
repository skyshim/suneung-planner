import React from "react";
import { parseISO } from "../api";

/** 계획 시작일 기준 하루에 하나씩, 목록 끝에 도달하면 처음부터 다시 돈다. */
export function quoteFor(meta, dateISO) {
  const list = meta.quotes || [];
  if (!list.length) return null;
  const days = Math.round((parseISO(dateISO) - parseISO(meta.plan_start)) / 86400000);
  return list[((days % list.length) + list.length) % list.length];
}

/** 파이널 기상·취침 단계. 기상을 당기는 만큼 취침도 당긴다. */
export function sleepPlan(dateISO) {
  if (dateISO <= "2026-10-18") return { bed: "1시", wake: null, warnAt: 24 };
  if (dateISO <= "2026-11-01") return { bed: "자정", wake: "7:00", warnAt: 23 };
  if (dateISO <= "2026-11-08") return { bed: "11시 반", wake: "6:30", warnAt: 22.5 };
  return { bed: "11시", wake: "6:00", warnAt: 22 };
}

export function BedtimeBanner({ banner, date }) {
  const now = new Date();
  const hh = now.getHours() + now.getMinutes() / 60;
  const plan = sleepPlan(date || "2026-10-18");
  // 취침 1시간 전부터, 그리고 새벽에는 더 강하게
  const urgent = hh >= plan.warnAt || hh < 5;
  const title = plan.wake ? `${plan.bed} 전에 취침!` : banner?.title || "1시 전에 취침!";
  const sub = plan.wake
    ? `내일 기상 ${plan.wake} · 넘기면 밀린 목록만 적고 바로 자기`
    : banner?.sub || "자정 넘으면 밀린 목록만 적고 바로 자기";
  return (
    <div className={`moon-card rounded-2xl px-4 py-3.5 mb-3 flex items-center gap-3.5 ${urgent ? "urgent" : ""}`}>
      <svg width="34" height="34" viewBox="0 0 40 40" className="moon-glow shrink-0" aria-hidden="true">
        <defs>
          <radialGradient id="mg" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff6d6" />
            <stop offset="100%" stopColor="#ffd87a" />
          </radialGradient>
        </defs>
        <path d="M26 5a15 15 0 1 0 9 26A13 13 0 0 1 26 5z" fill="url(#mg)" />
        <circle cx="16" cy="18" r="1.6" fill="#e9c66a" opacity=".55" />
        <circle cx="12" cy="26" r="1.1" fill="#e9c66a" opacity=".5" />
      </svg>
      <div className="min-w-0">
        <div
          className="text-[19px] font-extrabold leading-tight tracking-tight"
          style={{ color: urgent ? "#ffd3d8" : "var(--moon)" }}
        >
          {title}
        </div>
        <div className="text-[11.5px] font-semibold leading-snug mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

export function QuoteCard({ quote, dday }) {
  if (!quote) return null;
  return (
    <figure className="card px-4 py-3.5 mb-4 relative overflow-hidden">
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 rounded-full"
        style={{ width: 3, background: "linear-gradient(180deg, #a3b2ff, #b66dfb)", boxShadow: "0 0 10px rgba(163,178,255,.7)" }}
      />
      <div
        className="text-[10px] font-bold tracking-wider mb-1.5"
        style={{ color: "var(--text-muted)" }}
      >
        오늘의 한 문장 · D-{dday}
      </div>
      <blockquote className="text-[14.5px] font-semibold leading-relaxed" style={{ color: "#f3f1ff" }}>
        {quote.text}
      </blockquote>
      {quote.by && (
        <figcaption className="text-[11.5px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
          — {quote.by}
        </figcaption>
      )}
    </figure>
  );
}
