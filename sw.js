const SHELL_CACHE = 'ogtt-shell-v3';
const DATA_CACHE = 'ogtt-data-v3';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests; let everything else (fonts, etc.) pass through normally.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // data.json: always prefer a fresh network copy so a Netlify update shows up immediately.
  // Fall back to the last cached copy if offline.
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put('data.json', copy));
          return networkResponse;
        })
        .catch(() => caches.open(DATA_CACHE).then((cache) => cache.match('data.json')))
    );
    return;
  }

  // App shell (HTML/CSS/JS/icons): network-first so a fresh deploy shows up on the very
  // next load, falling back to the cached copy only when offline. A stale-first strategy
  // here was the reason updates weren't showing up even after a reload.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
