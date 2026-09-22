import React from "react";
import { fmtMin } from "../api";
import { Badge, SubjectChip, subjectColor } from "./ui";

/** 이 날 하기로 했다가 다른 날로 미룬 항목의 '자국'.
 *
 * 실제 행은 옮겨간 날짜에 있고 여기서는 흐리게만 보여준다. 그래야 나중에 그날로
 * 돌아왔을 때 '이건 이 날 못 했구나'가 한눈에 보인다.
 */
export default function MovedRow({ task: t, onUncarry }) {
  const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
  return (
    <div
      className="rounded-xl px-2.5 py-2"
      style={{
        border: "1px dashed var(--border-strong)",
        borderLeft: `3px solid ${subjectColor(t.subject)}`,
        background: "transparent",
        opacity: 0.62,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-md"
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            border: "1px dashed var(--border-strong)",
            background: "repeating-linear-gradient(135deg, transparent 0 3px, var(--surface-2) 3px 6px)",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[14px] font-semibold leading-tight"
              style={{ color: "var(--text-muted)" }}
            >
              {t.item || t.title}
            </span>
            <Badge tone={t.done ? "good" : "warn"}>
              {md(t.date)}
              {t.done ? "에 완료" : "로 미룸"}
            </Badge>
          </div>
          <div className="flex items-center gap-x-2 mt-0.5 flex-wrap">
            <SubjectChip subject={t.subject} />
            <span className="text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
              계획 {fmtMin(t.plan_min)}
            </span>
          </div>
        </div>
        {onUncarry && (
          <button
            type="button"
            onClick={() => onUncarry(t)}
            className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            되돌리기
          </button>
        )}
      </div>
    </div>
  );
}
