import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Empty, Section, subjectColor } from "../components/ui";

const md = (iso) => iso.slice(5).replace("-", "/").replace(/^0/, "");

/** 과목 하나 = 차트 하나 (소형 다중). 한 축(0~만점), 2px 선, 8px 점, 최근 점만 직접 라벨. */
function ScoreChart({ s }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 340;
  const H = 120;
  const pad = { t: 16, r: 22, b: 18, l: 28 };
  const pts = s.points;
  const color = subjectColor(s.subject);
  const n = pts.length;
  const x = (i) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => H - pad.b - (v / s.max) * (H - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join("");
  const ticks = [0, s.max / 2, s.max];

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = (e.clientX - r.left) * (W / r.width);
    if (n === 1) return setHover(0);
    const i = Math.round(((cx - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const h = hover != null ? pts[hover] : null;
  const last = pts[n - 1];

  return (
    <div className="relative" ref={ref} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${s.subject} 점수 추이`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9" fill="var(--text-muted)">{t}</text>
          </g>
        ))}
        {n > 1 && <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <circle key={p.task_id} cx={x(i)} cy={y(p.score)} r={hover === i ? 5 : 4} fill={color} stroke="var(--surface-1)" strokeWidth="2" />
        ))}
        {h && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" />}
        <text x={x(n - 1)} y={y(last.score) - 8} textAnchor={n === 1 ? "middle" : "end"} fontSize="10" fontWeight="800" fill="var(--text-primary)">
          {last.score}
        </text>
        <text x={pad.l} y={H - 4} fontSize="9" fill="var(--text-muted)">{md(pts[0].date)}</text>
        {n > 1 && (
          <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="9" fill="var(--text-muted)">{md(last.date)}</text>
        )}
      </svg>
      {h && (
        <div
          className="absolute pointer-events-none card px-2 py-1.5 text-[11px] tabnum"
          style={{
            top: 0,
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${x(hover) / W > 0.65 ? "-100%" : x(hover) / W > 0.35 ? "-50%" : "0"})`,
            maxWidth: 220,
            boxShadow: "0 4px 14px rgba(0,0,0,.18)",
          }}
        >
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
            {h.score}점 <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {s.max}</span>
          </div>
          <div className="truncate" style={{ color: "var(--text-secondary)" }}>{md(h.date)} · {h.source}</div>
        </div>
      )}
    </div>
  );
}

export default function MockStats() {
  const [data, setData] = useState(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    api.statsMocks().then((r) => setData(r.subjects));
  }, []);

  if (!data) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;
  const withData = data.filter((s) => s.count > 0);

  return (
    <div className="px-3 pt-3">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight">실모 성적</h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
            모의고사 할 일을 펼쳐 점수를 적으면 여기 쌓입니다.
          </p>
        </div>
        {withData.length > 0 && (
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            className="text-[12px] font-bold px-2 h-8 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {table ? "차트" : "표"}
          </button>
        )}
      </header>

      {withData.length === 0 ? (
        <Empty title="아직 기록한 점수가 없어요" hint="오늘·저녁체크에서 실모/모의고사 할 일을 펼치면 과목별 점수 칸이 있어요." />
      ) : table ? (
        <div className="card overflow-x-auto mb-4">
          <table className="w-full text-[12px] tabnum">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["날짜", "과목", "시험", "점수"].map((h) => (
                  <th key={h} className="text-left font-bold px-2.5 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withData
                .flatMap((s) => s.points.map((p) => ({ ...p, subject: s.subject, max: s.max })))
                .sort((a, b) => b.date.localeCompare(a.date) || a.subject.localeCompare(b.subject))
                .map((p) => (
                  <tr key={`${p.task_id}-${p.subject}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-2.5 py-1.5">{md(p.date)}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{p.subject}</td>
                    <td className="px-2.5 py-1.5" style={{ color: "var(--text-secondary)" }}>{p.source}</td>
                    <td className="px-2.5 py-1.5 font-bold">{p.score}<span style={{ color: "var(--text-muted)", fontWeight: 500 }}>/{p.max}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        withData.map((s) => (
          <Section
            key={s.subject}
            title={s.subject}
            right={
              <span className="text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
                {s.count}회
              </span>
            }
          >
            <div className="card px-3 pt-2.5 pb-2">
              <div className="grid grid-cols-3 gap-2 mb-1.5 tabnum">
                {[
                  ["최근", s.latest],
                  ["최고", s.best],
                  ["최근 3회 평균", s.recent_avg],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{l}</div>
                    <div className="text-[17px] font-extrabold leading-tight">
                      {v ?? "-"}
                      <span className="text-[10px] font-semibold ml-0.5" style={{ color: "var(--text-muted)" }}>/{s.max}</span>
                    </div>
                  </div>
                ))}
              </div>
              <ScoreChart s={s} />
            </div>
          </Section>
        ))
      )}
    </div>
  );
}
