import React, { useRef, useState } from "react";
import { api, fmtDate, todayISO } from "../api";
import { Section } from "../components/ui";

export default function Mindset({ meta }) {
  const days = meta.dday;
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const backup = async () => {
    const data = await api.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suneung-planner-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`${data.count}개 항목을 파일로 내려받았습니다.`);
  };

  const restore = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const payload = JSON.parse(await f.text());
      if (!confirm(`현재 데이터를 모두 지우고 백업 ${payload.tasks?.length ?? 0}개 항목으로 되돌립니다. 계속할까요?`)) return;
      const r = await api.importAll({ version: payload.version ?? 1, tasks: payload.tasks });
      setMsg(`${r.restored}개 항목을 복원했습니다. 새로고침하세요.`);
    } catch (err) {
      setMsg("복원 실패: " + err.message);
    } finally {
      e.target.value = "";
    }
  };
  return (
    <div className="px-3 pt-3">
      <header className="mb-4">
        <h1 className="text-[20px] font-extrabold leading-tight">마인드셋 / 운영 규칙</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
          수능 {meta.exam_date.replaceAll("-", ".")}까지 D-{days}
        </p>
      </header>

      <Section title="운영 규칙">
        <ol className="card px-3 py-1 divide-y" style={{ borderColor: "var(--border)" }}>
          {meta.rules.map((r, i) => (
            <li key={i} className="flex gap-2.5 py-2.5" style={{ borderColor: "var(--border)" }}>
              <span
                className="shrink-0 w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center tabnum"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {i + 1}
              </span>
              <span className="text-[13px] leading-relaxed">{r}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="마인드셋">
        <ul className="card px-3 py-1 divide-y" style={{ borderColor: "var(--border)" }}>
          {meta.mindset.map((m, i) => (
            <li key={i} className="py-2.5 text-[13px] leading-relaxed" style={{ borderColor: "var(--border)" }}>
              {m}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="항목 전환 규칙">
        <div className="card px-3 py-2.5 flex flex-col gap-2">
          {meta.items
            .filter((i) => i.next)
            .map((i) => (
              <div key={i.name} className="text-[12px] flex items-center gap-2 flex-wrap">
                <span className="font-bold">{i.name}</span>
                <span className="tabnum" style={{ color: "var(--text-muted)" }}>{i.cap}회 도달</span>
                <span style={{ color: "var(--text-muted)" }}>→</span>
                <span className="font-bold" style={{ color: "var(--accent)" }}>{i.next}</span>
              </div>
            ))}
        </div>
      </Section>

      <Section title="데이터 백업 / 복원">
        <div className="card px-3 py-3">
          <p className="text-[12px] leading-relaxed mb-2.5" style={{ color: "var(--text-secondary)" }}>
            Render 무료 PostgreSQL은 <b>생성 후 30일이 지나면 만료</b>됩니다. 계획 기간은 70일이므로,
            매주 한 번 백업 파일을 내려받아 두세요. DB를 새로 만든 뒤 이 파일로 그대로 되돌릴 수 있습니다.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={backup}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              백업 내려받기
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              백업에서 복원
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={restore} />
          </div>
          {msg && (
            <p className="text-[12px] mt-2 font-semibold" style={{ color: "var(--good)" }}>
              {msg}
            </p>
          )}
        </div>
      </Section>

      <p className="text-[11px] px-1 pb-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        계획 구간: {fmtDate(meta.plan_start)}(D-70) ~ 2026년 11월 9일(D-10) · 총 {meta.task_count}개 항목.
        규칙을 바꾸려면 <code>backend/app/data/item_master.json</code>만 수정하면 됩니다.
      </p>
    </div>
  );
}
