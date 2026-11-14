const VERSION = "__VERSION__";
const CACHE = `dcc-${VERSION}`;
const URLS = __URLS__;
/** The deployment base path ("" when served from the root). */
const BASE = "__BASE__";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(URLS)),
    // No skipWaiting here: a new version waits until the user accepts the update prompt (or every tab
    // is closed), so open tabs never lose the files they were loaded with.
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("dcc-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreSearch: pages like /guides/view?id=… share one prerendered file. ignoreVary: some servers send
      // `Vary: Origin`, which would stop module scripts and fonts (CORS-mode requests) from matching precached copies.
      const opts = { ignoreSearch: true, ignoreVary: true };
      // Pages may be cached with or without a trailing slash (see integrations/pwa.mjs): try both.
      const other = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : `${url.pathname}/`;
      const hit =
        (await cache.match(req, opts)) ??
        (req.mode === "navigate" && other ? await cache.match(other, opts) : undefined);
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === "navigate") return (await cache.match(`${BASE}/`)) ?? Response.error();
        throw err;
      }
    })(),
  );
});
