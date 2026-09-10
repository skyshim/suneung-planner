import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMin } from "../api";
import { Badge, ProgressBar, Section, subjectColor } from "../components/ui";

export default function ItemStats({ meta, onMetaChange }) {
  const [rows, setRows] = useState(null);
  const [table, setTable] = useState(false);
  const [editing, setEditing] = useState(null); // 수정 중인 항목명
  const [form, setForm] = useState({ minutes: "", cap: "", progress_by: "count", unit_goal: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => api.statsItems().then((r) => setRows(r.items));

  const openEdit = (r) => {
    const m = meta.items.find((i) => i.name === r.item);
    setEditing(r.item);
    setForm({
      minutes: m?.minutes ?? "",
      cap: r.cap ?? "",
      progress_by: r.progress_by || "count",
      unit_goal: r.unit_goal ?? "",
    });
    setMsg(null);
  };

  const apply = async (scope) => {
    setBusy(true);
    try {
      const res = await api.editItem(editing, {
        minutes: form.minutes === "" ? null : Number(form.minutes),
        cap: form.cap === "" ? null : Number(form.cap),
        progress_by: form.progress_by,
        unit_goal: form.unit_goal === "" ? null : Number(form.unit_goal),
        scope,
      });
      setMsg(
        scope === "future"
          ? `오늘 이후 ${res.changed}개 항목에 적용했습니다.`
          : `전체 ${res.changed}개 항목에 적용했습니다.`
      );
      await load();
      onMetaChange?.();
      setEditing(null);
    } catch (e) {
      setMsg("적용 실패: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
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

      {msg && (
        <div className="card px-3 py-2 mb-3 text-[12px] font-semibold" style={{ color: "var(--good)" }}>
          {msg}
        </div>
      )}

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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[12px] font-bold tabnum">
                        {r.progress_num}
                        <span style={{ color: "var(--text-muted)" }}>
                          /{r.progress_den}
                          {r.progress_by === "unit" ? r.unit || "" : r.progress_by === "minutes" ? "분" : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => (editing === r.item ? setEditing(null) : openEdit(r))}
                        aria-label={`${r.item} 분량 수정`}
                        className="rounded-md px-1 py-0.5"
                        style={{ color: editing === r.item ? "var(--accent)" : "var(--text-muted)" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <ProgressBar
                    ratio={r.ratio}
                    color={subjectColor(subject)}
                    label={`${r.item} ${r.done_count} / ${r.cap ?? r.planned_count} ${r.unit || "회"}`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1 text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
                    {r.progress_by !== "count" && (
                      <span style={{ color: "var(--text-muted)" }}>
                        기준: {r.progress_by === "unit" ? `카운트(${r.unit || "회"})` : "실제 시간"}
                      </span>
                    )}
                    <span>
                      완료 {r.done_count}
                      {r.cap ? `/${r.cap}회` : "회"} · 실제 {fmtMin(r.actual_min)}
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

                  {editing === r.item && (
                    <div
                      className="mt-2 p-2.5 rounded-xl"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                            회당 분량(분)
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="num-input w-full"
                            value={form.minutes}
                            onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                            상한(회)
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="num-input w-full"
                            value={form.cap}
                            onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="mt-2.5">
                        <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                          진행률을 무엇으로 잴까요
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            ["count", "완료 횟수"],
                            ["unit", `카운트(${r.unit || "회"})`],
                            ["minutes", "실제 시간"],
                          ].map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, progress_by: v }))}
                              className="py-1.5 rounded-lg border text-[11px] font-bold"
                              style={{
                                borderColor: form.progress_by === v ? "var(--accent)" : "var(--border)",
                                color: form.progress_by === v ? "var(--accent)" : "var(--text-secondary)",
                                background: form.progress_by === v ? "var(--accent-soft)" : "transparent",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {form.progress_by === "unit" && (
                          <label className="flex flex-col gap-1 mt-2">
                            <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                              카운트 목표 ({r.unit || "회"}) — 예: 영어마더텅 600지문
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              className="num-input w-full"
                              value={form.unit_goal}
                              onChange={(e) => setForm((f) => ({ ...f, unit_goal: e.target.value }))}
                            />
                          </label>
                        )}
                      </div>

                      <div className="flex gap-1.5 mt-2.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => apply("future")}
                          className="flex-1 py-2 rounded-lg text-[12px] font-bold disabled:opacity-50"
                          style={{ background: "var(--accent)", color: "#fff" }}
                        >
                          오늘 이후 적용
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => apply("all")}
                          className="flex-1 py-2 rounded-lg text-[12px] font-bold border disabled:opacity-50"
                          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
                        >
                          전체 적용
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="px-2.5 py-2 rounded-lg text-[12px] font-bold"
                          style={{ color: "var(--text-muted)" }}
                        >
                          취소
                        </button>
                      </div>
                      <div className="text-[10.5px] mt-1.5 leading-snug" style={{ color: "var(--text-muted)" }}>
                        회당 분량을 바꿨을 때만 기존 항목이 다시 쓰입니다. 오늘 이후 = 지나간 날은 그대로, 전체 = 과거 기록까지. 진행률 기준은 어느 버튼이든 함께 저장됩니다.
                      </div>
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
