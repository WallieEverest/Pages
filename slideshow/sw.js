// Shell + photo list: network first (so new photos show up), cache fallback offline.
// Photos: cache first, saved the first time each one is viewed, so the slideshow plays offline.
const VERSION = 'slideshow-v1';
const PHOTOS = 'slideshow-photos';
const SHELL = ['./', 'index.html', 'manifest.json', 'photos.json', 'icons/icon-180.png', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('slideshow-v') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (req.destination === 'image' && url.pathname.includes('/photos/')) {
    e.respondWith(
      caches.open(PHOTOS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) c.put(req, r.clone());
        return r;
      })))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
