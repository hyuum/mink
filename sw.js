// Offline support. The app's own files come from the network when it's reachable, so a new version
// shows up on the next open; the saved copy is used when offline or when the network is too slow.
const CACHE = 'matcha-planner-v3-mvi9eqxc';
const SHELL = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'icon.svg'];
const SLOW_MS = 3000;

self.addEventListener('install', (e) => {
  // "reload" skips the browser's HTTP cache, so the new version saves fresh files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const slow = new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    try {
      const res = await Promise.race([network, slow]);
      if (res) return res;
    } catch { /* offline: fall through to the saved copy */ }
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || network;
  })());
});
