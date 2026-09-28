// Offline copy of shared cards (scope: /card/). Network first; when the
// network fails (a hearing room with no signal), the last copy is served.
const CACHE = "ga-cards-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const cacheable =
    req.mode === "navigate" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/api/public/cards/") ||
    /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname);
  if (!cacheable) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/card/"))),
  );
});
