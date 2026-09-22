import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDays, api, fmtMin, parseISO } from "../api";
import { subjectColor } from "./ui";

const TYPES = ["고정세트", "인강", "모의고사", "오답정리"];
const UNITS = ["회", "강", "지문", "문제", "페이지"];
// 화면 표시는 월~일, 값은 JS getDay 규칙(0=일)
const WEEK = [
  [1, "월"],
  [2, "화"],
  [3, "수"],
  [4, "목"],
  [5, "금"],
  [6, "토"],
  [0, "일"],
];

/** 항목 추가 — 하루 / 반복(기간·패턴), 기존 항목 / 새 항목 등록.
 *
 * 새 항목은 먼저 '항목'으로 등록한 뒤 일정을 넣는다. 그래야 과목 색·항목별 현황·
 * 진행률·상한·과목별 통계에 기존 항목과 똑같이 잡힌다.
 */
export default function AddTask({ meta, date, onDone, onMetaChange }) {
  const items = useMemo(() => meta.items.filter((i) => i.name !== "자유시간"), [meta.items]);
  const planEnd = useMemo(() => addDays(meta.exam_date, -10), [meta.exam_date]);

  const [mode, setMode] = useState("once"); // once | repeat
  const [d, setD] = useState(date);
  const [start, setStart] = useState(date);
  const [end, setEnd] = useState(planEnd);
  const [pattern, setPattern] = useState("weekdays"); // daily | weekdays | every
  const [wds, setWds] = useState(() => new Set([parseISO(date).getDay()]));
  const [every, setEvery] = useState(2);

  const [name, setName] = useState(items[0]?.name ?? "");
  const [custom, setCustom] = useState("");
  const [nw, setNw] = useState({ name: "", subject: meta.subject_order[0], type: "고정세트", unit: "회", cap: "" });

  const [planMin, setPlanMin] = useState(items[0]?.minutes ?? "");
  const [countPlan, setCountPlan] = useState("");
  const [actualMin, setActualMin] = useState("");
  const [countActual, setCountActual] = useState("");
  const [extra, setExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [stats, setStats] = useState({});
  const [preview, setPreview] = useState(null);

  const isNew = name === "__new__";
  const isCustom = name === "__custom__";
  const picked = items.find((i) => i.name === name);
  const unit = isNew ? nw.unit : picked?.unit || "회";
  const cap = isNew ? (nw.cap === "" ? null : Number(nw.cap)) : picked?.cap;

  useEffect(() => {
    api.statsItems().then((r) => setStats(Object.fromEntries(r.items.map((x) => [x.item, x])))).catch(() => {});
  }, []);

  // 반복 모드: 날짜 목록 미리보기. 기존 항목이면 서버에 물어 이미 있는 날을 빼고 센다.
  const localDates = useMemo(() => {
    if (mode !== "repeat" || !start || !end || end < start) return [];
    const out = [];
    let i = 0;
    for (let x = start; x <= end && i < 200; x = addDays(x, 1), i++) {
      const wd = parseISO(x).getDay();
      if (pattern === "daily" || (pattern === "weekdays" && wds.has(wd)) || (pattern === "every" && i % Math.max(1, Number(every) || 1) === 0))
        out.push(x);
    }
    return out;
  }, [mode, start, end, pattern, wds, every]);

  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (mode !== "repeat" || isNew || isCustom || !picked) {
      setPreview(null);
      return;
    }
    if (!localDates.length) {
      setPreview({ dates: [], skipped: [] });
      return;
    }
    timer.current = setTimeout(() => {
      api
        .repeat({ item: name, start, end, mode: pattern, weekdays: [...wds], every: Number(every) || 1, preview: true })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [mode, name, start, end, pattern, wds, every, localDates.length, isNew, isCustom, picked]);

  const addCount = mode === "once" ? 1 : preview ? preview.dates.length : localDates.length;
  const skippedCount = mode === "repeat" && preview ? preview.skipped.length : 0;
  const already = isNew ? 0 : stats[name]?.planned_count ?? 0;
  const over = cap ? already + addCount - cap : 0;

  const pick = (v) => {
    setName(v);
    setErr(null);
    const m = items.find((i) => i.name === v);
    if (m) setPlanMin(m.minutes ?? "");
    if (v === "__custom__") setMode("once");
  };

  const toggleWd = (w) =>
    setWds((s) => {
      const n = new Set(s);
      n.has(w) ? n.delete(w) : n.add(w);
      return n;
    });

  const canSubmit =
    !saving &&
    !(isCustom && !custom.trim()) &&
    !(isNew && !nw.name.trim()) &&
    !(mode === "repeat" && addCount === 0);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      let itemName = name;
      if (isNew) {
        const created = await api.createItem({
          name: nw.name.trim(),
          subject: nw.subject,
          type: nw.type,
          minutes: planMin === "" ? null : Number(planMin),
          cap: nw.cap === "" ? null : Number(nw.cap),
          unit: nw.unit,
        });
        itemName = created.name;
        onMetaChange?.();
      }

      if (mode === "repeat") {
        const r = await api.repeat({
          item: itemName,
          start,
          end,
          mode: pattern,
          weekdays: [...wds],
          every: Number(every) || 1,
          plan_min: planMin === "" ? null : Number(planMin),
          count_plan: countPlan === "" ? null : Number(countPlan),
        });
        onDone?.(
          `${itemName} ${r.created}일 추가 · 계획 ${fmtMin(r.plan_min_total)}` +
            (r.skipped ? ` · 이미 있던 ${r.skipped}일은 건너뜀` : "")
        );
      } else {
        await api.create({
          date: d,
          item: isCustom ? null : itemName,
          title: isCustom ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${custom}` : null,
          subject: isCustom ? "전과목" : undefined,
          type: isCustom ? "고정세트" : undefined,
          // 덤은 계획이라는 개념이 없다. 실제로 한 만큼만 기록하고 바로 완료 처리한다.
          plan_min: extra ? null : planMin === "" ? null : Number(planMin),
          count_plan: extra ? null : countPlan === "" ? null : Number(countPlan),
          actual_min: extra ? (actualMin === "" ? null : Number(actualMin)) : null,
          count_actual: extra ? (countActual === "" ? null : Number(countActual)) : null,
          done: extra,
          count_unit: isCustom ? "회" : isNew ? nw.unit : picked?.unit,
          extra,
        });
        onDone?.(null);
      }
    } catch (e2) {
      const raw = String(e2.message || e2);
      setErr(raw.includes("409") ? "이미 있는 항목 이름입니다. 목록에서 고르세요." : "추가 실패: " + raw);
    } finally {
      setSaving(false);
    }
  };

  const L = ({ children }) => (
    <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
      {children}
    </span>
  );

  return (
    <form onSubmit={submit} className="card p-3 flex flex-col gap-2.5">
      {/* 하루 / 반복 */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["once", "하루"],
          ["repeat", "반복 (기간)"],
        ].map(([k, l]) => (
          <Chip
            key={k}
            on={mode === k}
            disabled={k === "repeat" && isCustom}
            onClick={() => {
              setMode(k);
              if (k === "repeat") setExtra(false);
            }}
            big
          >
            {l}
          </Chip>
        ))}
      </div>

      {/* 항목 */}
      <label className="flex flex-col gap-1">
        <L>항목</L>
        <select className="num-input w-full text-left" value={name} onChange={(e) => pick(e.target.value)}>
          {meta.subject_order.map((s) => {
            const list = items.filter((i) => i.subject === s);
            if (!list.length) return null;
            return (
              <optgroup key={s} label={s}>
                {list.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name}
                    {i.cap ? ` (상한 ${i.cap}${i.unit || "회"})` : ""}
                    {i.custom ? " · 직접 추가" : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="기타">
            <option value="__new__">+ 새 항목 만들기 (통계에 포함)</option>
            <option value="__custom__">일회성 메모 (하루만 · 통계 제외)</option>
          </optgroup>
        </select>
      </label>

      {isCustom && (
        <input
          className="num-input w-full text-left"
          placeholder="메모 이름"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}

      {isNew && (
        <div className="flex flex-col gap-2 p-2.5 rounded-xl" style={{ background: "var(--surface-2)" }}>
          <input
            className="num-input w-full text-left"
            placeholder="새 항목 이름 (예: 수특 수학)"
            value={nw.name}
            onChange={(e) => setNw((x) => ({ ...x, name: e.target.value }))}
          />
          <div>
            <L>과목</L>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {meta.subject_order.map((s) => (
                <Chip key={s} on={nw.subject === s} onClick={() => setNw((x) => ({ ...x, subject: s }))}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: subjectColor(s) }} />
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <L>유형</L>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {TYPES.map((t) => (
                <Chip key={t} on={nw.type === t} onClick={() => setNw((x) => ({ ...x, type: t }))}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <L>카운트 단위</L>
              <div className="flex gap-1 flex-wrap mt-1">
                {UNITS.map((u) => (
                  <Chip key={u} on={nw.unit === u} onClick={() => setNw((x) => ({ ...x, unit: u }))}>
                    {u}
                  </Chip>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <L>상한 ({nw.unit}) · 선택</L>
              <input
                type="number"
                inputMode="numeric"
                className="num-input w-full"
                placeholder="없음"
                value={nw.cap}
                onChange={(e) => setNw((x) => ({ ...x, cap: e.target.value }))}
              />
            </label>
          </div>
        </div>
      )}

      {/* 날짜 */}
      {mode === "once" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <L>날짜</L>
            <input type="date" className="num-input w-full text-left" value={d} onChange={(e) => setD(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <L>{extra ? "실제(분)" : isNew ? "회당 분량(분)" : "계획(분)"}</L>
            <input
              type="number"
              inputMode="numeric"
              className="num-input w-full"
              value={extra ? actualMin : planMin}
              onChange={(e) => (extra ? setActualMin(e.target.value) : setPlanMin(e.target.value))}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <L>시작</L>
              <input type="date" className="num-input w-full text-left" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <L>끝</L>
              <input type="date" className="num-input w-full text-left" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["daily", "매일"],
              ["weekdays", "요일 선택"],
              ["every", "N일마다"],
            ].map(([k, l]) => (
              <Chip key={k} on={pattern === k} onClick={() => setPattern(k)} big>
                {l}
              </Chip>
            ))}
          </div>
          {pattern === "weekdays" && (
            <div className="grid grid-cols-7 gap-1">
              {WEEK.map(([v, l]) => (
                <Chip key={v} on={wds.has(v)} onClick={() => toggleWd(v)} big>
                  {l}
                </Chip>
              ))}
            </div>
          )}
          {pattern === "every" && (
            <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                className="num-input w-16"
                value={every}
                onChange={(e) => setEvery(e.target.value)}
              />
              일마다 (시작일 포함)
            </label>
          )}
          <label className="flex flex-col gap-1">
            <L>{isNew ? "회당 분량(분)" : "하루 계획(분)"}</L>
            <input
              type="number"
              inputMode="numeric"
              className="num-input w-full"
              value={planMin}
              onChange={(e) => setPlanMin(e.target.value)}
            />
          </label>

          {/* 미리보기 */}
          <div
            className="rounded-xl px-2.5 py-2 text-[12px] tabnum"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            <div className="font-bold" style={{ color: "var(--text-primary)" }}>
              {addCount}일 추가 · 계획 {fmtMin((Number(planMin) || 0) * addCount)}
            </div>
            {addCount > 0 && (
              <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {(preview?.dates || localDates)
                  .slice(0, 6)
                  .map((x) => `${Number(x.slice(5, 7))}/${Number(x.slice(8, 10))}`)
                  .join(", ")}
                {addCount > 6 ? ` … 외 ${addCount - 6}일` : ""}
              </div>
            )}
            {skippedCount > 0 && (
              <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                이미 이 항목이 있는 {skippedCount}일은 건너뜁니다
              </div>
            )}
          </div>
        </div>
      )}

      {cap && over > 0 && (
        <div className="text-[11px] font-semibold px-0.5" style={{ color: "var(--warn)" }}>
          상한 {cap}
          {unit}인데 계획이 {already + addCount}{unit}이 됩니다 ({over}{unit} 초과). 현황 탭에서 상한을 올리거나 기간을 줄이세요.
        </div>
      )}

      <label className="flex flex-col gap-1">
        <L>
          {extra ? "카운트실제" : "카운트계획"} ({isCustom ? "회" : unit}) · 선택
        </L>
        <input
          type="number"
          inputMode="numeric"
          className="num-input w-full"
          value={extra ? countActual : countPlan}
          onChange={(e) => (extra ? setCountActual(e.target.value) : setCountPlan(e.target.value))}
        />
      </label>

      {mode === "once" && (
        <div>
          <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
            이 항목의 성격
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              [false, "계획에 추가", "과목별 '계획(분)'에 포함"],
              [true, "덤으로 한 것", "이미 한 것 · 실제 시간만 기록"],
            ].map(([v, label, hint]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setExtra(v)}
                className="px-2 py-2 rounded-xl border text-left"
                style={{
                  borderColor: extra === v ? "var(--accent)" : "var(--border)",
                  background: extra === v ? "var(--accent-soft)" : "transparent",
                }}
              >
                <div className="text-[12px] font-bold" style={{ color: extra === v ? "var(--accent)" : "var(--text-primary)" }}>
                  {label}
                </div>
                <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {hint}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {err && (
        <div className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
        style={{ background: "var(--accent-fill)", color: "var(--on-accent)" }}
      >
        {saving
          ? "추가하는 중…"
          : mode === "repeat"
            ? `${addCount}일에 추가`
            : extra
              ? "완료로 기록"
              : "추가"}
      </button>
    </form>
  );
}

function Chip({ on, onClick, children, big, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${big ? "py-1.5" : "px-2 py-1"} rounded-lg border text-[11.5px] font-bold disabled:opacity-40`}
      style={{
        borderColor: on ? "var(--accent)" : "var(--border)",
        color: on ? "var(--accent)" : "var(--text-secondary)",
        background: on ? "var(--accent-soft)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}
