import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMin } from "../api";
import CumulativeChart from "../components/CumulativeChart";
import { Section, subjectColor } from "../components/ui";

export default function SubjectStats() {
  const [subjects, setSubjects] = useState(null);
  const [table, setTable] = useState(false);
  const [focus, setFocus] = useState("전체");

  useEffect(() => {
    api.statsSubjects().then((r) => setSubjects(r.subjects));
  }, []);

  const merged = useMemo(() => {
    if (!subjects) return [];
    if (focus !== "전체") return subjects.find((s) => s.subject === focus)?.series ?? [];
    const m = new Map();
    for (const s of subjects)
      for (const p of s.series) {
        const cur = m.get(p.date) || { date: p.date, plan_min: 0, actual_min: 0 };
        cur.plan_min += p.plan_min;
        cur.actual_min += p.actual_min;
        m.set(p.date, cur);
      }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [subjects, focus]);

  if (!subjects) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;

  const maxPlan = Math.max(...subjects.map((s) => s.plan_min), 1);
  const totalPlan = subjects.reduce((a, s) => a + s.plan_min, 0);
  const totalActual = subjects.reduce((a, s) => a + s.actual_min, 0);

  return (
    <div className="px-3 pt-3">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight">과목별 현황</h1>
          <p className="text-[12px] mt-1 tabnum" style={{ color: "var(--text-secondary)" }}>
            전체 계획 {fmtMin(totalPlan)} · 실제 {fmtMin(totalActual)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="text-[12px] font-bold px-2 h-8 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {table ? "차트" : "표"}
        </button>
      </header>

      {table ? (
        <div className="card overflow-x-auto mb-4">
          <table className="w-full text-[12px] tabnum">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                {["과목", "계획(분)", "실제(분)", "달성률"].map((h) => (
                  <th key={h} className="text-left font-bold px-2.5 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-2.5 py-1.5 font-semibold">{s.subject}</td>
                  <td className="px-2.5 py-1.5">{s.plan_min}</td>
                  <td className="px-2.5 py-1.5">{s.actual_min}</td>
                  <td className="px-2.5 py-1.5">{s.plan_min ? Math.round((s.actual_min / s.plan_min) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <Section title="과목별 계획 대비 실제">
            <div className="card px-3 py-3 flex flex-col gap-3.5">
              {subjects.map((s) => {
                const planW = (s.plan_min / maxPlan) * 100;
                const actW = (s.actual_min / maxPlan) * 100;
                const rate = s.plan_min ? Math.round((s.actual_min / s.plan_min) * 100) : 0;
                return (
                  <div key={s.subject}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[13px] font-bold">{s.subject}</span>
                      <span className="text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
                        {fmtMin(s.actual_min)} / {fmtMin(s.plan_min)} · {rate}%
                      </span>
                    </div>
                    <div className="relative w-full" style={{ height: 16 }}>
                      <div
                        className="absolute left-0 top-0 rounded-md"
                        style={{ width: `${planW}%`, height: 16, background: "var(--surface-2)" }}
                        aria-hidden="true"
                      />
                      <div
                        className="absolute left-0 top-0 rounded-md"
                        style={{
                          width: `${actW}%`,
                          height: 16,
                          background: subjectColor(s.subject),
                          minWidth: s.actual_min ? 4 : 0,
                          boxShadow: "0 0 0 2px var(--surface-1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] mt-1.5 px-1" style={{ color: "var(--text-muted)" }}>
              연한 막대는 계획, 진한 막대는 실제 입력분입니다.
            </p>
          </Section>

          <Section
            title="누적 학습시간 추이"
            right={
              <select
                className="num-input text-left text-[11px] py-1"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              >
                <option value="전체">전체</option>
                {subjects.map((s) => (
                  <option key={s.subject} value={s.subject}>{s.subject}</option>
                ))}
              </select>
            }
          >
            <div className="card px-2 py-3">
              <CumulativeChart series={merged} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
