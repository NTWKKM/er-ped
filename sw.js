// ER-PED Service Worker
// ⚠️ IMPORTANT: Bump CACHE_NAME when dataset.json changes to push updates to users
// Format: er-ped-v{major}.{minor}.{patch}-{YYYYMMDD}
// Example: er-ped-v1.0.0-20250728
const CACHE_NAME = 'er-ped-v1.0.0-20250728';

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
