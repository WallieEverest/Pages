// Caches the app shell so it opens offline. Forecast data is cached by the page itself.
// Bump VERSION whenever you change index.html so phones pick up the new copy.
const VERSION = 'weather-v4';
const NWS_IMAGES = 'nws-images';   // separate name, so it survives VERSION bumps
const trim = c => c.keys().then(k => Promise.all(k.slice(0, -12).map(r => c.delete(r))));
const SHELL = ['./', 'index.html', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('weather-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // NWS briefing images: network first, keeping the most recent ones for offline use
  if (url.origin === 'https://www.weather.gov' && url.pathname.startsWith('/images/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { if (r.ok) { const copy = r.clone(); caches.open(NWS_IMAGES).then(c => c.put(e.request, copy).then(() => trim(c))); } return r; })
        .catch(() => caches.open(NWS_IMAGES).then(c => c.match(e.request)).then(hit => hit || Response.error()))
    );
    return;
  }
  if (url.origin !== location.origin) return; // API calls go straight to the network
  // Network first for the shell so updates appear quickly; fall back to cache offline.
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
