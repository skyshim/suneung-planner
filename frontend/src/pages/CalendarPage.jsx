import React, { useEffect, useMemo, useState } from "react";
import { api, addDays, iso, parseISO, todayISO, WD, fmtMin } from "../api";
import { Section } from "../components/ui";

/** 캘린더 칸에 들어갈 짧은 시간 표기. 1시간 미만은 0.5 단위로 보여준다. */
function hrs(min) {
  const m = min || 0;
  if (m === 0) return "0";
  const h = m / 60;
  return h < 1 ? (Math.round(h * 10) / 10).toString().replace(/^0/, ".") : String(Math.round(h));
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function CalendarPage({ meta, date, setDate, go }) {
  const base = parseISO(date);
  const [cur, setCur] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [mode, setMode] = useState("month");
  const [days, setDays] = useState({});

  const cells = useMemo(() => monthGrid(cur.y, cur.m), [cur]);
  const weekCells = useMemo(() => {
    const s = parseISO(date);
    s.setDate(s.getDate() - s.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [date]);

  const shown = mode === "month" ? cells : weekCells;

  useEffect(() => {
    const s = iso(shown[0]);
    const e = iso(shown[shown.length - 1]);
    api.range(s, e).then((r) => setDays(Object.fromEntries(r.days.map((d) => [d.date, d]))));
  }, [mode, cur.y, cur.m, date]);

  const move = (n) => {
    if (mode === "month") {
      const d = new Date(cur.y, cur.m + n, 1);
      setCur({ y: d.getFullYear(), m: d.getMonth() });
    } else {
      setDate(addDays(date, n * 7));
    }
  };

  const today = todayISO();
  const totalPlan = shown.reduce((a, d) => a + (days[iso(d)]?.plan_min || 0), 0);
  const totalDone = shown.reduce((a, d) => a + (days[iso(d)]?.done || 0), 0);
  const totalCnt = shown.reduce((a, d) => a + (days[iso(d)]?.count || 0), 0);
  const totalActual = shown.reduce((a, d) => a + (days[iso(d)]?.actual_min || 0), 0);

  return (
    <div className="px-3 pt-3">
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-[20px] font-extrabold">
          {mode === "month" ? `${cur.y}년 ${cur.m + 1}월` : `${parseISO(date).getMonth() + 1}월 주간`}
        </h1>
        <div className="flex gap-1.5">
          <Seg active={mode === "month"} onClick={() => setMode("month")}>월</Seg>
          <Seg active={mode === "week"} onClick={() => setMode("week")}>주</Seg>
          <Seg onClick={() => move(-1)}>◀</Seg>
          <Seg onClick={() => move(1)}>▶</Seg>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WD.map((w, i) => (
          <div
            key={w}
            className="text-center text-[11px] font-bold py-1"
            style={{ color: i === 0 ? "var(--danger)" : i === 6 ? "var(--accent)" : "var(--text-muted)" }}
          >
            {w}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-1 ${mode === "week" ? "" : ""}`}>
        {shown.map((d) => {
          const k = iso(d);
          const info = days[k];
          const inMonth = mode === "week" || d.getMonth() === cur.m;
          const isToday = k === today;
          const isSel = k === date;
          const ratio = info?.count ? info.done / info.count : 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setDate(k);
                go("today");
              }}
              className="rounded-lg border px-1 pt-1 pb-1.5 flex flex-col items-center gap-0.5 min-h-[64px]"
              style={{
                background: isSel ? "var(--accent-soft)" : "var(--surface-1)",
                borderColor: isSel ? "var(--accent)" : isToday ? "var(--border-strong)" : "var(--border)",
                opacity: inMonth ? 1 : 0.35,
              }}
            >
              <span
                className="text-[12px] font-bold tabnum"
                style={{ color: isToday ? "var(--accent)" : "var(--text-primary)" }}
              >
                {d.getDate()}
              </span>
              {info ? (
                <>
                  <span className="text-[9px] tabnum font-semibold" style={{ color: "var(--text-muted)" }}>
                    {info.done}/{info.count}
                  </span>
                  <span
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: 3, background: "var(--surface-2)" }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${ratio * 100}%`, background: "var(--good)" }}
                    />
                  </span>
                  <span className="text-[9px] tabnum leading-none" style={{ color: "var(--text-muted)" }}>
                    <b style={{ color: info.actual_min ? "var(--good)" : "var(--text-muted)" }}>
                      {hrs(info.actual_min)}
                    </b>
                    /{hrs(info.plan_min)}h
                  </span>
                </>
              ) : (
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                  —
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Section title={mode === "month" ? "표시 기간 요약" : "이 주 요약"}>
        <div className="card px-3 py-2.5 text-[12px] tabnum" style={{ color: "var(--text-secondary)" }}>
          <div className="flex items-center justify-between">
            <span>항목 {totalCnt}개 · 완료 {totalDone}개</span>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--good)" }}>{fmtMin(totalActual)}</span> / {fmtMin(totalPlan)}
            </span>
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            계획·항목 수는 이월 전 원래 날짜 기준. 다른 날로 미룬 항목은 그날 완료로 세지 않습니다. 실제 시간은 공부한 날 기준.
          </div>
        </div>
      </Section>
      <p className="text-[11px] px-1 pb-2" style={{ color: "var(--text-muted)" }}>
        날짜를 누르면 그날의 상세 리스트로 이동합니다. 계획 구간은 {meta.plan_start.replaceAll("-", ".")}(D-70) ~ 2026.11.09(D-10)이며, D-9~D-1은 비워둔 구간입니다.
      </p>
    </div>
  );
}

function Seg({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-bold px-2.5 h-8 rounded-lg border"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        background: active ? "var(--accent-soft)" : "var(--surface-1)",
      }}
    >
      {children}
    </button>
  );
}
