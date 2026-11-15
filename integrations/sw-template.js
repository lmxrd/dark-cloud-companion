const VERSION = "__VERSION__";
const CACHE = `dcc-${VERSION}`;
/** Pages of single database things, cached when opened or on request ("Save all for offline"). */
const PAGES_CACHE = `dcc-pages-${VERSION}`;
const URLS = __URLS__;
const PAGES = __PAGES__;
/** Their total size in bytes, for the Settings page. */
const PAGES_BYTES = __PAGES_BYTES__;
/** The deployment base path ("" when served from the root). */
const BASE = "__BASE__";

const strip = (path) => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);
const PAGE_SET = new Set(PAGES.map(strip));
const isPage = (url) => PAGE_SET.has(strip(url.pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(URLS)),
    // No skipWaiting here: a new version waits until the user accepts the update prompt (or every tab
    // is closed), so open tabs never lose the files they were loaded with.
  );
});

/** Fetches pages into the pages cache, a few at a time; reports progress after each. */
async function savePages(urls, report) {
  const cache = await caches.open(PAGES_CACHE);
  const queue = [...urls];
  let failed = 0;
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (res.ok) await cache.put(url, res);
        else failed++;
      } catch {
        failed++;
      }
      report?.(failed);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return failed;
}

/** The database pages already saved. */
async function savedPages() {
  const cache = await caches.open(PAGES_CACHE);
  const keys = await cache.keys();
  return new Set(keys.map((r) => strip(new URL(r.url).pathname)));
}

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  const reply = (msg) => event.source?.postMessage(msg);
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "PAGES_STATUS")
    event.waitUntil(
      savedPages().then((saved) =>
        reply({
          type: "PAGES_STATUS",
          done: PAGES.filter((u) => saved.has(strip(u))).length,
          total: PAGES.length,
          bytes: PAGES_BYTES,
        }),
      ),
    );
  if (type === "SAVE_PAGES")
    event.waitUntil(
      (async () => {
        const saved = await savedPages();
        const missing = PAGES.filter((u) => !saved.has(strip(u)));
        let done = PAGES.length - missing.length;
        const failed = await savePages(missing, (f) => {
          done++;
          reply({ type: "PAGES_PROGRESS", done: done - f, total: PAGES.length });
        });
        reply({ type: "PAGES_DONE", done: PAGES.length - failed, total: PAGES.length, failed });
      })(),
    );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Pages saved by an older version are fetched again for this one (their old copies point at
      // files this version deleted), in the background.
      const oldPages = keys.filter((k) => k.startsWith("dcc-pages-") && k !== PAGES_CACHE);
      const refetch = new Set();
      for (const k of oldPages)
        for (const r of await (await caches.open(k)).keys()) {
          const url = new URL(r.url);
          if (isPage(url)) refetch.add(url.pathname);
        }
      await Promise.all(
        keys
          .filter((k) => k.startsWith("dcc-") && k !== CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      if (refetch.size) savePages([...refetch]);
    })(),
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
      const page = isPage(url);
      if (page) {
        const pages = await caches.open(PAGES_CACHE);
        const saved =
          (await pages.match(req, opts)) ?? (other ? await pages.match(other, opts) : undefined);
        if (saved) return saved;
      }
      try {
        const res = await fetch(req);
        // A database page opened once stays available offline.
        if (page && res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(PAGES_CACHE).then((c) => c.put(url.pathname, copy)));
        }
        return res;
      } catch (err) {
        if (req.mode === "navigate") return (await cache.match(`${BASE}/`)) ?? Response.error();
        throw err;
      }
    })(),
  );
});
