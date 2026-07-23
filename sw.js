
const CACHE = 'er-ped-v1.26.07.23';
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
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
  } else {
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
  }
});
