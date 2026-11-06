/* SIA Mock Exam - service worker.
   NETWORK-FIRST on purpose. A cache-first worker pinned a broken build onto a
   phone once and could not be recovered; offline use is worth less than being
   able to ship a fix. Bump CACHE on every release. */

var CACHE = 'sia-mock-v1';

var SHELL = [
  './',
  'index.html',
  'app.css?v=1',
  'app.js?v=1',
  'questions.js?v=1',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // One bad URL must not fail the whole install.
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' }))['catch'](function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches['delete'](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') { return; }

  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    })['catch'](function () {
      return caches.match(e.request).then(function (hit) {
        if (hit) { return hit; }
        // A navigation that misses the cache still has to land somewhere.
        if (e.request.mode === 'navigate') { return caches.match('index.html'); }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
