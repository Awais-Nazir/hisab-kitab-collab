const CACHE_NAME = "hisab-kitab-v1";
const OFFLINE_URLS = ["/dashboard", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first: try the network, fall back to cache if offline.
  // This matters here because expense data changes constantly —
  // a cache-first strategy would show stale numbers.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});