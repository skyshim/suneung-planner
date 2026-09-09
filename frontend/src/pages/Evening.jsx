import React, { useCallback, useEffect, useState } from "react";
import { api, addDays, fmtDate, fmtMin, todayISO } from "../api";
import { Badge, Check, Empty, Section, SubjectChip, subjectColor } from "../components/ui";
import SortableList, { Grip } from "../components/SortableList";

/** 밤에 종이 플래너를 보며 한 화면에서 전부 체크 + 실제 시간 입력 → 한 번에 저장 */
export default function Evening({ meta, date, setDate }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = useCallback(async () => {
    const d = await api.day(date);
    setData(d);
    setDraft(
      Object.fromEntries(
        d.tasks.map((t) => [
          t.id,
          { done: !!t.done, actual_min: t.actual_min ?? "", count_actual: t.count_actual ?? "" },
        ])
      )
    );
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (id, patch) => setDraft((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const saveAll = async () => {
    setSaving(true);
    try {
      const items = Object.entries(draft).map(([id, v]) => ({
        id: Number(id),
        done: v.done,
        actual_min: v.actual_min === "" ? null : Number(v.actual_min),
        count_actual: v.count_actual === "" ? null : Number(v.count_actual),
      }));
      const fresh = await api.bulk(date, items);
      setData(fresh);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  const carryUnfinished = async () => {
    const ids = Object.entries(draft).filter(([, v]) => !v.done).map(([id]) => Number(id));
    if (!ids.length) return;
    setSaving(true);
    await saveAllQuiet();
    await api.carry(ids, addDays(date, 1));
    await load();
    setSaving(false);
  };

  const saveAllQuiet = async () => {
    const items = Object.entries(draft).map(([id, v]) => ({
      id: Number(id),
      done: v.done,
      actual_min: v.actual_min === "" ? null : Number(v.actual_min),
      count_actual: v.count_actual === "" ? null : Number(v.count_actual),
    }));
    await api.bulk(date, items);
  };

  if (!data) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;

  const doneCount = Object.values(draft).filter((v) => v.done).length;
  const actualSum = Object.values(draft).reduce((a, v) => a + (Number(v.actual_min) || 0), 0);
  const unfinished = data.tasks.length - doneCount;

  return (
    <div className="px-3 pt-3 pb-2">
      <header className="mb-3">
        <h1 className="text-[20px] font-extrabold leading-tight">저녁 일괄 체크</h1>
        <div className="text-[13px] mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
          {fmtDate(date)} · D-{data.dday}
        </div>
        <div className="flex gap-1.5 mt-2">
          <BtnS onClick={() => setDate(addDays(date, -1))}>◀ 전날</BtnS>
          <BtnS onClick={() => setDate(todayISO())}>오늘</BtnS>
          <BtnS onClick={() => setDate(addDays(date, 1))}>다음날 ▶</BtnS>
        </div>
      </header>

      {data.tasks.length === 0 ? (
        <Empty title="이 날짜에는 항목이 없습니다" hint="'오늘' 탭에서 항목을 추가할 수 있습니다." />
      ) : (
        <>
          <Section title={`${data.tasks.length}개 항목 · 종이 플래너 보며 한 번에 입력`}>
            <SortableList
              items={data.tasks}
              gap={6}
              getId={(t) => t.id}
              onReorder={async (ids) => {
                setData((d) => ({ ...d, tasks: ids.map((id) => d.tasks.find((t) => t.id === id)) }));
                await api.reorder(date, ids);
              }}
              renderItem={(t, { handleProps }) => {
                const v = draft[t.id] || {};
                return (
                  <div className="card px-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <Grip handleProps={handleProps} />
                      <Check checked={!!v.done} onChange={(x) => set(t.id, { done: x })} size={24} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[14px] font-semibold truncate"
                          style={{ color: v.done ? "var(--text-muted)" : "var(--text-primary)" }}
                        >
                          {t.item || t.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <SubjectChip subject={t.subject} />
                          <span className="text-[11px] tabnum" style={{ color: "var(--text-muted)" }}>
                            계획 {fmtMin(t.plan_min)}
                          </span>
                          {t.carried > 0 && <Badge tone="danger">이월 {t.carried}</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>실제(분)</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="num-input w-16 mt-0.5"
                            placeholder={String(t.plan_min ?? 0)}
                            value={v.actual_min ?? ""}
                            onChange={(e) => set(t.id, { actual_min: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>
                            {t.count_unit || "회"}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="num-input w-12 mt-0.5"
                            placeholder="—"
                            value={v.count_actual ?? ""}
                            onChange={(e) => set(t.id, { count_actual: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="h-0.5" style={{ background: subjectColor(t.subject), opacity: v.done ? 0.9 : 0.18, marginTop: 8, borderRadius: 2 }} />
                  </div>
                );
              }}
            />
          </Section>

          <div
            className="sticky -mx-3 px-3 pt-3 pb-3"
            style={{
              bottom: "calc(64px + env(safe-area-inset-bottom))",
              background: "linear-gradient(to top, var(--surface-0) 78%, transparent)",
            }}
          >
            <div className="flex items-center justify-between text-[12px] mb-2 tabnum px-0.5" style={{ color: "var(--text-secondary)" }}>
              <span>완료 {doneCount}/{data.tasks.length} · 실제 {fmtMin(actualSum)}</span>
              {savedAt && <span style={{ color: "var(--good)" }}>저장됨 {savedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {saving ? "저장 중…" : "한 번에 저장"}
              </button>
              <button
                type="button"
                onClick={carryUnfinished}
                disabled={saving || unfinished === 0}
                className="px-3 py-3 rounded-xl text-[13px] font-bold border disabled:opacity-40"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
              >
                미완료 {unfinished}개 내일로
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BtnS({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-bold px-2.5 h-8 rounded-lg border"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface-1)" }}
    >
      {children}
    </button>
  );
}
