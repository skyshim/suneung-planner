const base = "";

async function req(path, opts = {}) {
  const res = await fetch(base + path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  meta: () => req("/api/meta"),
  day: (d) => req(`/api/day/${d}`),
  range: (s, e) => req(`/api/range?start=${s}&end=${e}`),
  patch: (id, body) => req(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  create: (body) => req("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  remove: (id) => req(`/api/tasks/${id}`, { method: "DELETE" }),
  bulk: (d, items) => req(`/api/day/${d}/bulk`, { method: "POST", body: JSON.stringify({ items }) }),
  reorder: (d, ids) => req(`/api/day/${d}/reorder`, { method: "POST", body: JSON.stringify({ ids }) }),
  carry: (ids, to) => req("/api/carry", { method: "POST", body: JSON.stringify({ ids, to }) }),
  statsItems: () => req("/api/stats/items"),
  editItem: (name, body) =>
    req(`/api/items/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify(body) }),
  statsSubjects: () => req("/api/stats/subjects"),
  exportAll: () => req("/api/export"),
  importAll: (payload) => req("/api/import", { method: "POST", body: JSON.stringify(payload) }),
};

export const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function fmtMin(m) {
  if (!m) return "0분";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

export function fmtDate(s) {
  const d = parseISO(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}
