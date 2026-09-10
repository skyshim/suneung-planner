import React, { useMemo, useState } from "react";
import { api } from "../api";

export default function AddTask({ meta, date, onDone }) {
  const items = useMemo(() => meta.items.filter((i) => i.name !== "자유시간"), [meta.items]);
  const [d, setD] = useState(date);
  const [name, setName] = useState(items[0]?.name ?? "");
  const [custom, setCustom] = useState("");
  const [planMin, setPlanMin] = useState(items[0]?.minutes ?? "");
  const [countPlan, setCountPlan] = useState("");
  const [actualMin, setActualMin] = useState("");
  const [countActual, setCountActual] = useState("");
  const [saving, setSaving] = useState(false);
  const [extra, setExtra] = useState(false);

  const picked = items.find((i) => i.name === name);
  const isCustom = name === "__custom__";

  const pick = (v) => {
    setName(v);
    const m = items.find((i) => i.name === v);
    setPlanMin(m?.minutes ?? "");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.create({
        date: d,
        item: isCustom ? null : name,
        title: isCustom ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} ${custom}` : null,
        subject: isCustom ? "전과목" : undefined,
        type: isCustom ? "고정세트" : undefined,
        // 덤은 계획이라는 개념이 없다. 실제로 한 만큼만 기록하고 바로 완료 처리한다.
        plan_min: extra ? null : planMin === "" ? null : Number(planMin),
        count_plan: extra ? null : countPlan === "" ? null : Number(countPlan),
        actual_min: extra ? (actualMin === "" ? null : Number(actualMin)) : null,
        count_actual: extra ? (countActual === "" ? null : Number(countActual)) : null,
        done: extra,
        count_unit: isCustom ? "회" : picked?.unit,
        extra,
      });
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-3 flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>날짜</span>
          <input type="date" className="num-input w-full text-left" value={d} onChange={(e) => setD(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {extra ? "실제(분)" : "계획(분)"}
          </span>
          <input
            type="number"
            inputMode="numeric"
            className="num-input w-full"
            value={extra ? actualMin : planMin}
            onChange={(e) => (extra ? setActualMin(e.target.value) : setPlanMin(e.target.value))}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>항목</span>
        <select
          className="num-input w-full text-left"
          value={name}
          onChange={(e) => pick(e.target.value)}
        >
          {items.map((i) => (
            <option key={i.name} value={i.name}>
              {i.subject} · {i.name}
              {i.cap ? ` (상한 ${i.cap}회)` : ""}
            </option>
          ))}
          <option value="__custom__">직접 입력…</option>
        </select>
      </label>
      {isCustom && (
        <input
          className="num-input w-full text-left"
          placeholder="항목 이름"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {extra ? "카운트실제" : "카운트계획"} ({isCustom ? "회" : picked?.unit || "회"}) · 선택
        </span>
        <input
          type="number"
          inputMode="numeric"
          className="num-input w-full"
          value={extra ? countActual : countPlan}
          onChange={(e) => (extra ? setCountActual(e.target.value) : setCountPlan(e.target.value))}
        />
      </label>
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
              <div
                className="text-[12px] font-bold"
                style={{ color: extra === v ? "var(--accent)" : "var(--text-primary)" }}
              >
                {label}
              </div>
              <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                {hint}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || (isCustom && !custom.trim())}
        className="py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {saving ? "추가하는 중…" : extra ? "완료로 기록" : "추가"}
      </button>
    </form>
  );
}
