// ER-PED Service Worker
// ⚠️ IMPORTANT: Bump CACHE_NAME on EVERY release that changes app.js/index.html/dataset.js —
// app.js, index.html, and dataset.js are served cache-first (see fetch handler below), so the
// browser's native update check (reg.update() -> 'updatefound') only fires when THIS FILE's
// bytes change. If CACHE_NAME is left unchanged, deployed PWA clients silently keep running the
// old cached app.js/index.html indefinitely, even though dataset.json itself refreshes via
// stale-while-revalidate. Bump this on every release, not just dataset-only changes.
// Format: er-ped-v{major}.{minor}.{patch}-{YYYYMMDD}
// Example: er-ped-v1.4.0-20260729
const CACHE_NAME = 'er-ped-v1.5.5-20260729';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app.js',
  './dataset.js',
  './dataset.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    self.clients.claim();
  })());
});

// Stale-while-revalidate for dataset.json (clinical data may update)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isDataset = url.pathname.includes('dataset.json');
  
  if (url.origin === location.origin) {
    if (isDataset) {
      // Stale-while-revalidate for dataset - serve cached, update in background
      e.respondWith(caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      }));
    } else {
      // Cache-first for static assets
      e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
    }
  } else {
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
  }
});
