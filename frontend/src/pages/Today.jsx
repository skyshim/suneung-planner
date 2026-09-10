import React, { useCallback, useEffect, useState } from "react";
import { api, addDays, fmtDate, fmtMin, todayISO } from "../api";
import TaskRow from "../components/TaskRow";
import AddTask from "../components/AddTask";
import { Badge, Empty, Section, Stat } from "../components/ui";
import SortableList, { Grip } from "../components/SortableList";
import { BedtimeBanner, QuoteCard, quoteFor } from "../components/DailyQuote";

export default function Today({ meta, date, setDate, go }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const load = useCallback(async () => {
    setData(await api.day(date));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const patchLocal = (saved, refresh) => {
    setData((d) =>
      d
        ? {
            ...d,
            tasks: d.tasks.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)),
            overdue: d.overdue.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)),
          }
        : d
    );
    if (refresh) load();
  };

  const carryOne = async (t) => {
    setBusy(true);
    await api.carry([t.id], addDays(t.date, 1));
    await load();
    setBusy(false);
  };

  const carryAllOverdue = async () => {
    if (!data?.overdue?.length) return;
    setBusy(true);
    await api.carry(data.overdue.map((t) => t.id), date);
    await load();
    setBusy(false);
  };

  if (!data) return <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;

  const isToday = date === todayISO();
  const remain = data.tasks.filter((t) => !t.done);
  const extraCount = data.tasks.filter((t) => t.extra).length;
  const pct = data.tasks.length ? Math.round((data.done_count / data.tasks.length) * 100) : 0;

  return (
    <div className="px-3 pt-3">
      <BedtimeBanner banner={meta.banner} />

      <header className="mb-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[30px] font-extrabold tabnum leading-none">D-{data.dday}</span>
              {isToday && <Badge tone="accent">오늘</Badge>}
            </div>
            <div className="text-[13px] mt-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
              {fmtDate(date)} · 수능 {meta.exam_date.replaceAll("-", ".")}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <NavBtn label="◀" onClick={() => setDate(addDays(date, -1))} />
            <NavBtn label="오늘" onClick={() => setDate(todayISO())} wide />
            <NavBtn label="▶" onClick={() => setDate(addDays(date, 1))} />
          </div>
        </div>
      </header>

      <QuoteCard quote={quoteFor(meta, date)} dday={data.dday} />

      <div className="flex gap-2 mb-4">
        <Stat
          label="오늘 계획"
          value={fmtMin(data.plan_min_total)}
          sub={
            extraCount
              ? `계획 ${data.tasks.length - extraCount}개 + 덤 ${extraCount}개`
              : `${data.tasks.length}개 항목`
          }
        />
        <Stat label="완료" value={`${data.done_count}/${data.tasks.length}`} sub={`${pct}% · 남은 ${remain.length}개`} />
        <Stat label="실제" value={fmtMin(data.actual_min_total)} sub="입력 누계" />
      </div>

      {data.overdue.length > 0 && (
        <Section
          title={`밀린 것 · ${data.overdue.length}개`}
          tone="var(--danger)"
          right={
            <button
              type="button"
              disabled={busy}
              onClick={carryAllOverdue}
              className="text-[12px] font-bold px-2 py-1 rounded-lg border"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              전부 오늘로 이월
            </button>
          }
        >
          <div className="flex flex-col gap-2">
            {(showAllOverdue ? data.overdue : data.overdue.slice(0, 4)).map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                progress={data.item_progress[t.item]}
                onChange={patchLocal}
                onCarry={() => api.carry([t.id], date).then(load)}
              />
            ))}
            {data.overdue.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllOverdue((v) => !v)}
                className="py-2 rounded-xl text-[12px] font-bold border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {showAllOverdue ? "접기" : `밀린 것 ${data.overdue.length - 4}개 더 보기`}
              </button>
            )}
          </div>
        </Section>
      )}

      <Section
        title="오늘 할 일"
        right={
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="text-[12px] font-bold px-2 py-1 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {adding ? "닫기" : "+ 항목 추가"}
          </button>
        }
      >
        {adding && (
          <div className="mb-2">
            <AddTask
              meta={meta}
              date={date}
              onDone={() => {
                setAdding(false);
                load();
              }}
            />
          </div>
        )}
        {data.tasks.length === 0 ? (
          <Empty
            title="이 날짜에는 계획이 없습니다"
            hint={
              date < meta.plan_start
                ? `계획은 ${fmtDate(meta.plan_start)}(D-70)부터 시작합니다.`
                : "D-9~D-1 구간은 비워두고 그때그때 유동적으로 대응하기로 한 구간입니다."
            }
            action={
              date < meta.plan_start && (
                <button
                  type="button"
                  onClick={() => setDate(meta.plan_start)}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  D-70({fmtDate(meta.plan_start)})로 이동
                </button>
              )
            }
          />
        ) : (
          <SortableList
            items={data.tasks}
            getId={(t) => t.id}
            onReorder={async (ids) => {
              setData((d) => ({
                ...d,
                tasks: ids.map((id) => d.tasks.find((t) => t.id === id)),
              }));
              await api.reorder(date, ids);
            }}
            renderItem={(t, { handleProps }) => (
              <TaskRow
                task={t}
                handle={<Grip handleProps={handleProps} />}
                progress={data.item_progress[t.item]}
                onChange={patchLocal}
                onCarry={carryOne}
                onDelete={async (x) => {
                  await api.remove(x.id);
                  load();
                }}
              />
            )}
          />
        )}
      </Section>

      <button
        type="button"
        onClick={() => go("evening")}
        className="w-full mb-4 py-3 rounded-xl text-[14px] font-bold"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        밤에 한 번에 체크하기 →
      </button>
    </div>
  );
}

function NavBtn({ label, onClick, wide }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] font-bold rounded-lg border h-8 ${wide ? "px-2.5" : "w-8"}`}
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface-1)" }}
    >
      {label}
    </button>
  );
}
