import React, { useCallback, useEffect, useState } from "react";
import { api, addDays, fmtDate, fmtMin, todayISO } from "../api";
import TaskRow from "../components/TaskRow";
import AddTask from "../components/AddTask";
import MovedRow from "../components/MovedRow";
import { Badge, Empty, Section, Stat } from "../components/ui";
import SortableList, { Grip } from "../components/SortableList";
import { BedtimeBanner, QuoteCard, quoteFor } from "../components/DailyQuote";

export default function Today({ meta, date, setDate, go, onMetaChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState(null);
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

  const skipTask = async (t, value = true) => {
    setBusy(true);
    await api.skip([t.id], value);
    await load();
    setBusy(false);
  };

  const skipAllOverdue = async () => {
    if (!data?.overdue?.length) return;
    setBusy(true);
    await api.skip(data.overdue.map((x) => x.id), true);
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
  const extraCount = data.tasks.filter((t) => t.extra).length;
  const moved = data.moved_away || [];
  // 그날 하기로 했던 것 = 지금 이 날에 있는 항목 + 다른 날로 미룬 항목. 캘린더와 같은 기준.
  const plannedCount = data.planned_count ?? data.tasks.length;
  const pct = plannedCount ? Math.round((data.done_count / plannedCount) * 100) : 0;
  const remain = Math.max(0, plannedCount - data.done_count);

  return (
    <div className="px-3 pt-3">
      <BedtimeBanner banner={meta.banner} />

      <header className="mb-3">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[34px] font-extrabold tabnum leading-none glow-text">D-{data.dday}</span>
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
            moved.length
              ? `${plannedCount}개 항목 · ${moved.length}개 미룸`
              : extraCount
                ? `계획 ${data.tasks.length - extraCount}개 + 덤 ${extraCount}개`
                : `${data.tasks.length}개 항목`
          }
        />
        <Stat label="완료" value={`${data.done_count}/${plannedCount}`} sub={`${pct}% · 남은 ${remain}개`} />
        <Stat label="실제" value={fmtMin(data.actual_min_total)} sub="입력 누계" />
      </div>

      {data.overdue.length > 0 && (
        <Section
          title={`밀린 것 · ${data.overdue.length}개`}
          tone="var(--danger)"
          right={
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={skipAllOverdue}
                className="text-[12px] font-bold px-2 py-1 rounded-lg border"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
              >
                전부 포기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={carryAllOverdue}
                className="text-[12px] font-bold px-2 py-1 rounded-lg border"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                전부 오늘로
              </button>
            </div>
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
                carryLabel={isToday ? "오늘로 이월" : `${fmtDate(date).replace(" (", "(")}로 이월`}
                onSkip={skipTask}
              />
            ))}
            <p className="text-[11px] px-0.5" style={{ color: "var(--text-muted)" }}>
              '포기'를 누르면 원래 계획 날짜에 <b>못 한 것</b>으로 남고, 이 목록에서 사라집니다.
            </p>
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
              onMetaChange={onMetaChange}
              onDone={(msg) => {
                setAdding(false);
                setNotice(msg);
                load();
              }}
            />
          </div>
        )}
        {notice && !adding && (
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="card w-full text-left px-3 py-2 mb-2 text-[12px] font-semibold"
            style={{ color: "var(--good)" }}
          >
            {notice} <span style={{ color: "var(--text-muted)" }}>· 닫기</span>
          </button>
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
                  style={{ background: "var(--accent-fill)", color: "var(--on-accent)" }}
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
              // 화면을 먼저 바꿔 즉시 반응하게 하고(못 찾는 id 는 버린다), 서버 응답으로 덮어쓴다.
              setData((d) => {
                const next = ids.map((id) => d.tasks.find((t) => t.id === id)).filter(Boolean);
                return next.length === d.tasks.length ? { ...d, tasks: next } : d;
              });
              try {
                setData(await api.reorder(date, ids));
              } catch (e) {
                console.error("reorder failed", e);
                load();
              }
            }}
            renderItem={(t, { handleProps }) => (
              <TaskRow
                task={t}
                handle={<Grip handleProps={handleProps} />}
                progress={data.item_progress[t.item]}
                onChange={patchLocal}
                onCarry={carryOne}
                onSkip={date < todayISO() || t.skipped ? skipTask : undefined}
                onUncarry={async (x) => {
                  await api.uncarry([x.id]);
                  load();
                }}
                onDelete={async (x) => {
                  await api.remove(x.id);
                  load();
                }}
              />
            )}
          />
        )}
        {moved.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-[11px] font-semibold px-0.5" style={{ color: "var(--text-muted)" }}>
              이 날 하기로 했다가 미룬 것 · {moved.length}개
            </div>
            {moved.map((t) => (
              <MovedRow
                key={t.id}
                task={t}
                onUncarry={async (x) => {
                  await api.uncarry([x.id]);
                  load();
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <button
        type="button"
        onClick={() => go("evening")}
        className="w-full mb-4 py-3 rounded-xl text-[14px] font-bold"
        style={{ background: "var(--accent-fill)", color: "var(--on-accent)" }}
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
