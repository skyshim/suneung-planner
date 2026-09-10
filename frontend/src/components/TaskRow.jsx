import React, { useEffect, useRef, useState } from "react";
import { api, fmtMin } from "../api";
import { Badge, Check, SubjectChip, subjectColor } from "./ui";

/** 값이 바뀌면 400ms 뒤 자동 저장(디바운스). 저장 버튼 없음. */
function useAutoSave(id, onSaved) {
  const timer = useRef(null);
  const pending = useRef({});
  useEffect(() => () => clearTimeout(timer.current), []);
  return (patch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    const flush = async () => {
      const body = pending.current;
      pending.current = {};
      if (!Object.keys(body).length) return;
      try {
        const saved = await api.patch(id, body);
        onSaved?.(saved, "done" in body);
      } catch (e) {
        console.error("save failed", e);
      }
    };
    if (immediate) flush();
    else timer.current = setTimeout(flush, 400);
  };
}

export default function TaskRow({ task, onChange, onCarry, onDelete, expanded: forceOpen = false, progress, handle = null }) {
  const [t, setT] = useState(task);
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => setT(task), [task.id, task.date, task.done, task.actual_min, task.count_actual]);
  useEffect(() => setOpen(forceOpen), [forceOpen]);
  const save = useAutoSave(t.id, (saved) => onChange?.(saved));

  const set = (patch, immediate) => {
    const next = { ...t, ...patch };
    setT(next);
    onChange?.(next, true);
    save(patch, immediate);
  };

  const name = t.item || t.title.replace(/^\d+\/\d+\([^)]+\)\s*/, "");
  const nearCap = progress?.near_cap && !progress?.reached;
  const reached = progress?.reached;

  return (
    <div
      className="card overflow-hidden"
      data-task-id={t.id}
      style={{ borderLeft: `3px solid ${subjectColor(t.subject)}` }}
    >
      <div className="flex items-start gap-2 px-2.5 py-2.5">
        {handle}
        <Check checked={!!t.done} onChange={(v) => set({ done: v }, true)} />
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[15px] font-semibold leading-tight ${t.done ? "line-through" : ""}`}
              style={{ color: t.done ? "var(--text-muted)" : "var(--text-primary)" }}
            >
              {name}
            </span>
            {t.carried > 0 && <Badge tone="danger">이월 {t.carried}</Badge>}
            {t.extra && <Badge tone="accent">덤</Badge>}
            {nearCap && <Badge tone="warn">상한 임박 {progress.done_count}/{progress.cap}</Badge>}
            {reached && <Badge tone="good">상한 완료</Badge>}
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 flex-wrap">
            <SubjectChip subject={t.subject} />
            <span className="text-[11px] tabnum whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              {t.type}
            </span>
            {!t.extra && (
              <span
                className="text-[11px] tabnum font-semibold whitespace-nowrap"
                style={{ color: "var(--text-secondary)" }}
              >
                계획 {fmtMin(t.plan_min)}
              </span>
            )}
            {t.actual_min ? (
              <span
                className="text-[11px] tabnum font-semibold whitespace-nowrap"
                style={{ color: "var(--good)" }}
              >
                실제 {fmtMin(t.actual_min)}
              </span>
            ) : null}
          </div>
        </button>
        <span
          className="text-[11px] tabnum shrink-0 pt-1"
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                실제(분) — 한 시간
              </span>
              <input
                type="number"
                inputMode="numeric"
                className="num-input w-full"
                value={t.actual_min ?? ""}
                placeholder={String(t.plan_min ?? 0)}
                onChange={(e) => set({ actual_min: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                카운트실제 ({t.count_unit || "회"})
              </span>
              <input
                type="number"
                inputMode="numeric"
                className="num-input w-full"
                value={t.count_actual ?? ""}
                placeholder={t.count_plan != null ? String(t.count_plan) : "—"}
                onChange={(e) => set({ count_actual: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
          </div>
          {!t.extra && (
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                계획(분) — 이 날만
              </span>
              <input
                type="number"
                inputMode="numeric"
                className="num-input w-full"
                value={t.plan_min ?? ""}
                onChange={(e) => set({ plan_min: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                카운트계획 ({t.count_unit || "회"})
              </span>
              <input
                type="number"
                inputMode="numeric"
                className="num-input w-full"
                value={t.count_plan ?? ""}
                onChange={(e) => set({ count_plan: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
          </div>
          )}

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {!t.extra && (
              <button
                type="button"
                onClick={() => set({ actual_min: t.plan_min, done: true }, true)}
                className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                계획대로 완료
              </button>
            )}
            {!t.done && onCarry && (
              <button
                type="button"
                onClick={() => onCarry(t)}
                className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
              >
                내일로 이월
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border ml-auto"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                삭제
              </button>
            )}
          </div>
          {progress?.cap && (
            <div className="text-[11px] mt-2 tabnum" style={{ color: "var(--text-muted)" }}>
              {t.item} 누적 {progress.done_count}/{progress.cap}
              {progress.next ? ` · 상한 도달 시 → ${progress.next}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
