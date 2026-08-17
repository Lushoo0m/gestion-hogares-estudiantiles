// Service Worker: cachea el "cascarón" de la app para que abra sin internet.
// Los datos viven en localStorage del dispositivo, no acá — esto solo cachea
// los archivos estáticos (HTML/CSS/JS/iconos).

const CACHE_NAME = 'gh-estudiantiles-v14';
const ARCHIVOS_APP = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/data.js',
  './js/pdf.js',
  './js/app.js',
  './js/vendor/jspdf.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_APP))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first para los archivos de la app, con actualización en segundo plano.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      const fetchPromise = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.ok) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => respuestaCache);
      return respuestaCache || fetchPromise;
    })
  );
});
