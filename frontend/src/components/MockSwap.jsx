import React, { useEffect, useState } from "react";
import { api } from "../api";

const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const body = (t) => (t.title || "").replace(/^\d+\/\d+\([^)]+\)\s*/, "");

/** 실모가 아직 없을 때: 다른 날 실모와 맞바꾸거나, 이 날만 다른 실모로 바꾼다. */
export default function MockSwap({ task, onDone }) {
  const [opts, setOpts] = useState(null);
  const [item, setItem] = useState("");
  const [detail, setDetail] = useState("");
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.mockOptions(task.id).then(setOpts).catch((e) => setErr(String(e)));
  }, [task.id]);

  const run = async (payload) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.mockChange(task.id, payload);
      onDone(r.day, r.note);
    } catch (e) {
      setErr(String(e.message || e).replace(/^\d+ /, ""));
    } finally {
      setBusy(false);
    }
  };

  const sub = { color: "var(--text-muted)" };
  if (!opts) return <div className="text-[11px] mt-2" style={sub}>{err || "불러오는 중…"}</div>;

  return (
    <div className="mt-2.5 pt-2.5 border-t flex flex-col gap-3" style={{ borderColor: "var(--border)" }}>
      <div>
        <div className="text-[12px] font-bold mb-1">다른 날 실모랑 맞바꾸기</div>
        <p className="text-[11px] mb-1.5" style={sub}>
          '{body(task)}'은(는) 그 날짜로 가고, 그 실모를 오늘 풀어요.
        </p>
        {opts.swap.length ? (
          <div className="flex flex-col gap-1.5">
            {opts.swap.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => run({ swap_with: s.id })}
                className="text-left text-[12px] font-semibold px-2.5 py-2 rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <span className="tabnum" style={sub}>{md(s.date)}</span> {s.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px]" style={sub}>같은 과목의 다른 실모가 뒤에 없어요.</p>
        )}
      </div>

      <div>
        <div className="text-[12px] font-bold mb-1.5">계획에 없는 실모로 바꾸기</div>
        <div className="flex gap-1.5">
          <input
            className="num-input flex-1 min-w-0"
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
          <input
            className="num-input text-left"
            style={{ width: 84, textAlign: "left" }}
            placeholder="회차"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        {task.item && (
          <label className="flex items-start gap-1.5 mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} className="mt-0.5" />
            <span>
              '{body(task)}'은(는) 뒤의 {task.item} 칸으로 한 칸씩 밀기
              {opts.same_left ? ` (남은 ${opts.same_left}칸 · 맨 끝 회차는 빠짐)` : " (뒤에 칸이 없어 빠짐)"}
            </span>
          </label>
        )}
        <button
          type="button"
          disabled={busy || !item.trim()}
          onClick={() => run({ item: item.trim(), detail: detail.trim(), push })}
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
