import React, { useMemo, useRef, useState } from "react";
import { api, fmtMin } from "../api";
import { subjectColor } from "./ui";

const COLS = 6; // 한 시간을 10분씩 6칸
const ROWS = 24; // 05시부터 다음날 04시까지
export const SLOT_COUNT = ROWS * COLS;

/** 0 = 05:00~05:10 ... 143 = 04:50~05:00 */
const hourLabel = (row) => String((5 + row) % 24).padStart(2, "0");

export default function TimeGrid({ date, tasks, onChanged }) {
  const [sel, setSel] = useState(null); // 선택된 항목 id, "eraser", 또는 null
  const [fillPlan, setFillPlan] = useState(true);
  const [pending, setPending] = useState(null); // 드래그 중 미리보기 slot Set
  const dragging = useRef(false);
  const gridRef = useRef(null);

  // slot → task 소유자 맵
  const owner = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.slots) continue;
      for (const s of t.slots.split(",")) {
        const n = Number(s);
        if (!Number.isNaN(n)) m.set(n, t);
      }
    }
    return m;
  }, [tasks]);

  const selected = sel === "eraser" ? null : tasks.find((t) => t.id === sel);
  const selColor = sel === "eraser" ? "var(--text-muted)" : subjectColor(selected?.subject);

  const commit = async (slots, mode) => {
    if (!slots.length) return;
    const fresh = await api.paintSlots(date, {
      task_id: sel === "eraser" ? null : sel,
      slots,
      mode,
    });
    onChanged(fresh);
  };

  const slotAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const v = el?.getAttribute?.("data-slot");
    return v == null ? null : Number(v);
  };

  const onDown = (e) => {
    if (sel == null) return;
    const s = slotAt(e.clientX, e.clientY);
    if (s == null) return;

    // 계획만큼 채우기: 시작 칸을 누르면 계획 분량만큼 이어서 칠한다
    if (fillPlan && sel !== "eraser" && selected?.plan_min) {
      const n = Math.round(selected.plan_min / 10);
      const run = [];
      for (let i = 0; i < n && s + i < SLOT_COUNT; i++) run.push(s + i);
      commit(run, "add");
      return;
    }
    dragging.current = true;
    setPending(new Set([s]));
  };

  const onMove = (e) => {
    if (!dragging.current) return;
    const s = slotAt(e.clientX, e.clientY);
    if (s == null) return;
    setPending((p) => (p?.has(s) ? p : new Set([...(p || []), s])));
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const slots = [...(pending || [])];
    setPending(null);
    commit(slots, sel === "eraser" ? "remove" : "add");
  };

  const totalMin = tasks.reduce((a, t) => a + (t.slots ? t.slots.split(",").length * 10 : 0), 0);

  return (
    <div>
      {/* 항목 고르기 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-3 px-3" style={{ scrollbarWidth: "none" }}>
        {tasks.map((t) => {
          const mins = t.slots ? t.slots.split(",").length * 10 : 0;
          const on = sel === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSel(on ? null : t.id)}
              className="shrink-0 px-2.5 py-1.5 rounded-xl border text-left"
              style={{
                borderColor: on ? subjectColor(t.subject) : "var(--border)",
                background: on ? "var(--surface-2)" : "transparent",
                borderWidth: on ? 2 : 1,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: subjectColor(t.subject) }}
                />
                <span className="text-[12px] font-bold whitespace-nowrap">{t.item || t.title}</span>
              </div>
              <div className="text-[10px] tabnum mt-0.5" style={{ color: "var(--text-muted)" }}>
                {mins ? `${mins}분` : "—"} / 계획 {t.plan_min ?? 0}분
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSel(sel === "eraser" ? null : "eraser")}
          className="shrink-0 px-3 rounded-xl border text-[12px] font-bold"
          style={{
            borderColor: sel === "eraser" ? "var(--danger)" : "var(--border)",
            color: sel === "eraser" ? "var(--danger)" : "var(--text-secondary)",
            borderWidth: sel === "eraser" ? 2 : 1,
          }}
        >
          지우개
        </button>
      </div>

      {/* 안내 + 모드 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
          {sel == null
            ? "항목을 먼저 고르세요"
            : sel === "eraser"
              ? "지울 칸을 누르거나 문지르세요"
              : fillPlan
                ? "시작 시간을 누르면 계획 분량만큼 칠해집니다"
                : "칸을 누르거나 옆으로 문질러 칠하세요"}
        </span>
        {sel != null && sel !== "eraser" && (
          <button
            type="button"
            onClick={() => setFillPlan((v) => !v)}
            className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border"
            style={{
              borderColor: fillPlan ? "var(--accent)" : "var(--border)",
              color: fillPlan ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {fillPlan ? "계획만큼" : "1칸씩"}
          </button>
        )}
      </div>

      {/* 격자 */}
      <div
        ref={gridRef}
        className="card p-1.5"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          dragging.current = false;
          setPending(null);
        }}
      >
        <div className="flex items-center gap-[2px] mb-1 pl-[30px]">
          {[10, 20, 30, 40, 50, 60].map((m) => (
            <div
              key={m}
              className="flex-1 text-center text-[9px] tabnum"
              style={{ color: "var(--text-muted)" }}
            >
              {m}
            </div>
          ))}
        </div>
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-[1px] mb-[2px]">
            <div
              className="text-[10px] tabnum font-semibold text-right pr-1.5"
              style={{ width: 30, color: "var(--text-muted)" }}
            >
              {hourLabel(row)}
            </div>
            {Array.from({ length: COLS }, (_, col) => {
              const slot = row * COLS + col;
              const own = owner.get(slot);
              const isPending = pending?.has(slot);
              const bg = isPending
                ? selColor
                : own
                  ? subjectColor(own.subject)
                  : "var(--surface-2)";

              // 같은 항목이 이어지는 칸은 틈 없이 한 덩어리로 보이게 한다(종이 플래너처럼).
              const idOf = (s) => (pending?.has(s) ? "pending" : (owner.get(s)?.id ?? null));
              const me = idOf(slot);
              const sameLeft = col > 0 && me != null && idOf(slot - 1) === me;
              const sameRight = col < COLS - 1 && me != null && idOf(slot + 1) === me;

              return (
                <div
                  key={col}
                  data-slot={slot}
                  className="flex-1"
                  style={{
                    height: 22,
                    background: bg,
                    // 항목을 고르면 그 항목이 칠한 칸만 또렷하게 보여준다
                    opacity: isPending
                      ? 0.65
                      : own && sel != null && sel !== "eraser" && own.id !== sel
                        ? 0.3
                        : 1,
                    border: "1px solid var(--border)",
                    borderLeftColor: sameLeft ? "transparent" : "var(--border)",
                    borderRightColor: sameRight ? "transparent" : "var(--border)",
                    borderTopLeftRadius: sameLeft ? 0 : 3,
                    borderBottomLeftRadius: sameLeft ? 0 : 3,
                    borderTopRightRadius: sameRight ? 0 : 3,
                    borderBottomRightRadius: sameRight ? 0 : 3,
                    marginRight: sameRight ? -1 : 0,
                    marginLeft: sameLeft ? -1 : 0,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="text-[12px] tabnum font-bold mt-2 text-right"
        style={{ color: "var(--text-secondary)" }}
      >
        칠한 시간 합계 <span style={{ color: "var(--good)" }}>{fmtMin(totalMin)}</span>
      </div>
    </div>
  );
}
