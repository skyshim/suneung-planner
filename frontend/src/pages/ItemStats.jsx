import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMin } from "../api";
import { Badge, ProgressBar, Section, subjectColor } from "../components/ui";

export default function ItemStats({ meta }) {
  const [rows, setRows] = useState(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    api.statsItems().then((r) => setRows(r.items));
  }, []);

  const groups = useMemo(() => {
    if (!rows) return [];
    const by = new Map();
    for (const r of rows) {
      if (!by.has(r.subject)) by.set(r.subject, []);
      by.get(r.subject).push(r);
    }
    return meta.subject_order.filter((s) => by.has(s)).map((s) => [s, by.get(s)]);
  }, [rows, meta.subject_order]);

  if (!rows) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;

  return (
    <div className="px-3 pt-3">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold leading-tight">항목별 현황</h1>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
            완료 횟수 / 상한 기준 진행률 · 전환 규칙 포함
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
                {["항목", "과목", "완료/상한", "실제(분)", "목표(분)"].map((h) => (
                  <th key={h} className="text-left font-bold px-2.5 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{r.item}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.subject}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{r.done_count}/{r.cap ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{r.actual_min}</td>
                  <td className="px-2.5 py-1.5">{r.goal_min ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        groups.map(([subject, items]) => (
          <Section key={subject} title={subject}>
            <div className="card px-3 py-3 flex flex-col gap-3.5">
              {items.map((r) => (
                <div key={r.item}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13px] font-bold truncate">{r.item}</span>
                      {r.reached && <Badge tone="good">상한 완료</Badge>}
                      {r.near_cap && !r.reached && <Badge tone="warn">임박</Badge>}
                      {r.pair && <Badge tone="muted">짝: {r.pair}</Badge>}
                    </div>
                    <span className="text-[12px] font-bold tabnum shrink-0">
                      {r.done_count}
                      <span style={{ color: "var(--text-muted)" }}>/{r.cap ?? r.planned_count}</span>
                    </span>
                  </div>
                  <ProgressBar
                    ratio={r.ratio}
                    color={subjectColor(subject)}
                    label={`${r.item} ${r.done_count} / ${r.cap ?? r.planned_count} ${r.unit || "회"}`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
                    <span>
                      실제 {fmtMin(r.actual_min)}
                      {r.goal_min ? ` / 목표 ${fmtMin(r.goal_min)}` : ""}
                      {r.count_actual ? ` · ${r.count_actual}${r.unit || ""}` : ""}
                    </span>
                    {r.next && (
                      <span style={{ color: "var(--accent)" }}>상한 도달 시 → {r.next}</span>
                    )}
                  </div>
                  {r.note && (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {r.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}
