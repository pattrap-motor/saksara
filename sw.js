// sw.js — Saksara service worker
//
// Caching konservatif untuk app shell saja:
// - Navigasi (halaman) memakai network-first: deployment baru selalu menang
//   saat online; salinan cache hanya dipakai sebagai cadangan saat offline.
// - Aset statis same-origin memakai stale-while-revalidate.
// - Permintaan lintas origin (model di huggingface.co, CDN jsdelivr,
//   Google Fonts) dan semua jalur /api/ TIDAK pernah dicegat — selalu
//   langsung ke jaringan.
// - Worker ini hanya mengelola cache "saksara-shell-*"; penyimpanan cache
//   milik komponen lain di origin yang sama tidak disentuh sama sekali.

const CACHE_NAME = 'saksara-shell-v1';
const CACHE_PREFIX = 'saksara-shell-';
const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Lintas origin: jangan dicegat (model, CDN, font — langsung ke jaringan).
  if (url.origin !== self.location.origin) return;

  // Endpoint API: jangan dicegat dan jangan disimpan di cache.
  if (url.pathname.startsWith('/api/')) return;

  // Navigasi halaman: network-first, fallback ke cache saat offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // Aset statis same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
