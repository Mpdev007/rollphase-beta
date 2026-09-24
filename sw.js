/**
 * RollPhase service worker — network-first so deploys reach phones.
 * buildId is rewritten by scripts/bump-version.js on every ship.
 * BUILD_ID: 20260805-2209-b0c7f28
 */
/* eslint-disable no-restricted-globals */
const BUILD_ID = "20260805-2209-b0c7f28";

self.addEventListener("install", (event) => {
  // Activate immediately so the next navigation can use this worker
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old caches from previous builds
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("rollphase-") && k !== `rollphase-${BUILD_ID}`)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/** Network-first: always prefer the live server after a deploy. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin app assets
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        // Optionally keep a short-lived cache of successful responses
        if (fresh && fresh.ok && url.pathname.endsWith(".json") === false) {
          const cache = await caches.open(`rollphase-${BUILD_ID}`);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cache = await caches.open(`rollphase-${BUILD_ID}`);
        const hit = await cache.match(req);
        if (hit) return hit;
        // Fallback: any previous rollphase cache
        const keys = await caches.keys();
        for (const k of keys) {
          if (!k.startsWith("rollphase-")) continue;
          const c = await caches.open(k);
          const m = await c.match(req);
          if (m) return m;
        }
        throw new Error("offline");
      }
    })()
  );
});
