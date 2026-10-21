import React, { useEffect, useState } from "react";
import { api } from "../api";

const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const body = (t) => (t.title || "").replace(/^\d+\/\d+\([^)]+\)\s*/, "");

/** 실모를 못 풀었거나 아직 없을 때: 다음 날로 미루기 / 다른 날 실모와 맞바꾸기 / 다른 실모로 바꾸기. */
export default function MockSwap({ task, onDone }) {
  const [opts, setOpts] = useState(null);
  const [item, setItem] = useState("");
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.mockOptions(task.id).then(setOpts).catch((e) => setErr(String(e)));
  }, [task.id]);

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fn();
      onDone(r.day || null, r.note);
    } catch (e) {
      setErr(String(e.message || e).replace(/^\d+ /, ""));
    } finally {
      setBusy(false);
    }
  };

  const sub = { color: "var(--text-muted)" };
  const btn = { borderColor: "var(--border)", color: "var(--text-secondary)" };
  if (!opts) return <div className="text-[11px] mt-2" style={sub}>{err || "불러오는 중…"}</div>;

  return (
    <div className="mt-2.5 pt-2.5 border-t flex flex-col gap-3.5" style={{ borderColor: "var(--border)" }}>
      {!opts.fixed && (
        <div>
          <div className="text-[12px] font-bold mb-1">못 풀었으면 미루기</div>
          <p className="text-[11px] mb-1.5" style={sub}>
            {opts.next_date
              ? `'${body(task)}'을(를) 다음 ${task.subject} 실모 날(${md(opts.next_date)})로 보내고, 뒤의 ${task.subject} 실모도 한 칸씩 밀려요. 맨 끝 하나는 빠져요.`
              : `뒤에 ${task.subject} 실모 칸이 없어서 미루면 계획에서 빠져요.`}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => api.mockPostpone(task.id))}
            className="w-full h-9 rounded-lg text-[12px] font-bold border"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            {task.subject} 실모 한 칸 미루기
          </button>
        </div>
      )}

      <div>
        <div className="text-[12px] font-bold mb-1">다른 날 실모랑 맞바꾸기</div>
        <p className="text-[11px] mb-1.5" style={sub}>
          아직 배송 안 왔을 때. '{body(task)}'은(는) 그 날짜로 가고, 그 실모를 이 날 풀어요.
        </p>
        {opts.swap.length ? (
          <div className="flex flex-col gap-1.5">
            {opts.swap.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => run(() => api.mockChange(task.id, { swap_with: s.id }))}
                className="text-left text-[12px] font-semibold px-2.5 py-2 rounded-lg border"
                style={btn}
              >
                <span className="tabnum" style={sub}>{md(s.date)}</span> {s.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px]" style={sub}>뒤에 같은 과목의 다른 실모가 없어요.</p>
        )}
      </div>

      <div>
        <div className="text-[12px] font-bold mb-1.5">계획에 없는 실모로 바꾸기</div>
        <input
          className="num-input w-full"
          style={{ textAlign: "left" }}
          list={`mock-items-${task.id}`}
          placeholder="실모 이름 (예: 강대K)"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
        <datalist id={`mock-items-${task.id}`}>
          {opts.items.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <label className="flex items-start gap-1.5 mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} className="mt-0.5" />
          <span>'{body(task)}'은(는) 다음 {task.subject} 실모 날로 밀기 (끄면 그냥 빠짐)</span>
        </label>
        <button
          type="button"
          disabled={busy || !item.trim()}
          onClick={() => run(() => api.mockChange(task.id, { item: item.trim(), push }))}
          className="mt-2 w-full h-9 rounded-lg text-[12px] font-bold border"
          style={{
            borderColor: "var(--accent)",
            color: "var(--accent)",
            background: "var(--accent-soft)",
            opacity: busy || !item.trim() ? 0.5 : 1,
          }}
        >
          이 날 실모 바꾸기
        </button>
      </div>
      {err && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
