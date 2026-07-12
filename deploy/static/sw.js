// Service worker mínimo: cachea el "cascarón" de la app para que abra offline
// e instalable como PWA. NO cacheo /predict (siempre necesita el servidor).
const CACHE = 'tos-covid-v1';
const ARCHIVOS = ['.', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
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
  // Las llamadas al backend nunca se cachean
  if (url.pathname.endsWith('/predict') || url.pathname.endsWith('/health')) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
