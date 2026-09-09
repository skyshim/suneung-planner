// 온라인 우선 전략. 배포로 파일이 바뀌어도 항상 최신을 받아오고,
// 네트워크가 끊겼을 때만 캐시로 떨어진다. (파일명이 고정이라 캐시 우선은 위험)
const CACHE = "suneung-planner";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // API 응답은 캐시하지 않는다(데이터 최신성). 정적 파일만 오프라인용으로 보관.
        if (!url.pathname.startsWith("/api/") && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => {
          if (hit) return hit;
          // 오프라인 상태에서 페이지 이동이면 셸을 돌려준다
          if (e.request.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        })
      )
  );
});
