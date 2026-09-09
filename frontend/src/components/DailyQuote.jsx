import React from "react";
import { parseISO } from "../api";

/** 계획 시작일 기준 하루에 하나씩, 목록 끝에 도달하면 처음부터 다시 돈다. */
export function quoteFor(meta, dateISO) {
  const list = meta.quotes || [];
  if (!list.length) return null;
  const days = Math.round((parseISO(dateISO) - parseISO(meta.plan_start)) / 86400000);
  return list[((days % list.length) + list.length) % list.length];
}

export function BedtimeBanner({ banner }) {
  const h = new Date().getHours();
  const urgent = h >= 23 || h < 5; // 자정 전후에는 더 강하게
  return (
    <div
      className="rounded-2xl px-4 py-3 mb-3 flex items-center gap-3"
      style={{
        background: urgent ? "var(--danger)" : "var(--surface-1)",
        border: `2px solid ${urgent ? "var(--danger)" : "var(--danger)"}`,
      }}
    >
      <span className="text-[22px] leading-none" aria-hidden="true">
        🌙
      </span>
      <div className="min-w-0">
        <div
          className="text-[19px] font-extrabold leading-tight tracking-tight"
          style={{ color: urgent ? "#fff" : "var(--danger)" }}
        >
          {banner?.title || "1시 전에 취침!"}
        </div>
        <div
          className="text-[11.5px] font-semibold leading-snug mt-0.5"
          style={{ color: urgent ? "rgba(255,255,255,.9)" : "var(--text-secondary)" }}
        >
          {banner?.sub || "자정 넘으면 밀린 목록만 적고 바로 자기"}
        </div>
      </div>
    </div>
  );
}

export function QuoteCard({ quote, dday }) {
  if (!quote) return null;
  return (
    <figure
      className="card px-4 py-3.5 mb-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div
        className="text-[10px] font-bold tracking-wider mb-1.5"
        style={{ color: "var(--text-muted)" }}
      >
        오늘의 한 문장 · D-{dday}
      </div>
      <blockquote className="text-[14px] font-semibold leading-relaxed">
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
