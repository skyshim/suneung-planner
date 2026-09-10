import React, { useEffect, useState } from "react";
import { api, todayISO } from "./api";
import Today from "./pages/Today";
import Evening from "./pages/Evening";
import CalendarPage from "./pages/CalendarPage";
import ItemStats from "./pages/ItemStats";
import SubjectStats from "./pages/SubjectStats";
import Mindset from "./pages/Mindset";

const TABS = [
  { key: "today", label: "오늘", icon: "M4 5h16M4 12h16M4 19h10" },
  { key: "evening", label: "저녁체크", icon: "M5 12l4 4L19 7" },
  { key: "calendar", label: "캘린더", icon: "M4 8h16M8 4v3M16 4v3M5 5h14v15H5z" },
  { key: "stats", label: "현황", icon: "M5 20V10M12 20V4M19 20v-7" },
  { key: "rules", label: "규칙", icon: "M6 4h12v16H6zM9 9h6M9 13h6" },
];

export default function App() {
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState(() => location.hash.slice(1) || "today");
  const [date, setDate] = useState(todayISO());
  const [statTab, setStatTab] = useState("item");
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.meta().then(setMeta).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    location.hash = tab;
  }, [tab]);

  useEffect(() => {
    const h = () => setTab(location.hash.slice(1) || "today");
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);

  if (err)
    return (
      <div className="p-6 text-sm">
        <p className="font-bold mb-2">서버에 연결하지 못했습니다.</p>
        <p style={{ color: "var(--text-muted)" }}>{err}</p>
      </div>
    );
  if (!meta) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중…</div>;

  return (
    <div className="min-h-full flex flex-col" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
      <main className="flex-1 max-w-lg w-full mx-auto">
        {tab === "today" && <Today meta={meta} date={date} setDate={setDate} go={setTab} />}
        {tab === "evening" && <Evening meta={meta} date={date} setDate={setDate} />}
        {tab === "calendar" && <CalendarPage meta={meta} date={date} setDate={setDate} go={setTab} />}
        {tab === "stats" && (
          <div>
            <div className="flex gap-1.5 px-3 pt-3">
              {[
                ["item", "항목별"],
                ["subject", "과목별"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatTab(k)}
                  className="text-[12px] font-bold px-3 h-8 rounded-lg border"
                  style={{
                    borderColor: statTab === k ? "var(--accent)" : "var(--border)",
                    color: statTab === k ? "var(--accent)" : "var(--text-secondary)",
                    background: statTab === k ? "var(--accent-soft)" : "var(--surface-1)",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {statTab === "item" ? (
              <ItemStats meta={meta} onMetaChange={() => api.meta().then(setMeta)} />
            ) : (
              <SubjectStats />
            )}
          </div>
        )}
        {tab === "rules" && <Mindset meta={meta} />}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 border-t"
        style={{
          background: "var(--surface-1)",
          borderColor: "var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2.5"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d={t.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
