// Service worker: cachea el "cascarón" para que la PWA abra offline e instalable.
// NO cacheo /predict (siempre necesita el servidor).
const CACHE = 'aliento-v4';
const ARCHIVOS = ['.', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
                  'fonts/inter-400.woff2', 'fonts/inter-600.woff2', 'fonts/inter-700.woff2',
                  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((claves) =>
    Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/predict') || url.pathname.endsWith('/health')) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
