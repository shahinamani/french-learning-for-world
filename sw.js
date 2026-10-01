// Service worker — what makes the portal work without a connection.
//
// A commute is the natural study slot and it is exactly where signal is worst,
// so the app shell and all content are cached on first visit.
//
// Strategy is stale-while-revalidate: serve from the cache immediately, then
// refresh the copy in the background. The learner never waits for the network,
// and never stays more than one visit behind. Bump CACHE when the shell
// changes; old caches are deleted on activate.

const CACHE = 'flw-v2';

const SHELL = [
  './',
  'index.html',
  'app/styles.css',
  'app/main.js',
  'app/fsrs.js',
  'app/timer.js',
  'app/chime.js',
  'app/storage.js',
  'app/i18n.js',
  'app/cardKey.js',
  'content/decks.json',
  'content/fr-core-a1.json',
  'content/exams.json',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll fails the whole install if one file 404s, which is the point:
    // a half-cached shell is worse than no offline support, because it fails
    // later and less comprehensibly.
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) return cached;                 // instant, even offline
      const fresh = await network;
      if (fresh) return fresh;
      // Offline and never cached: a navigation still gets the shell.
      return (await cache.match('index.html'))
        ?? new Response('Offline', { status: 503, statusText: 'Offline' });
    }),
  );
});
