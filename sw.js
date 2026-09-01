// Service worker: cache-first sobre el shell de la app, versionado, con
// actualización automática (skipWaiting + clients.claim). La versión nueva se
// activa sola y toma el control; js/app.js recarga la página una vez cuando
// eso ocurre. El guardado es en cada interacción, así que la recarga no
// pierde nada. Sube VERSION en cada despliegue para que el móvil recoja los
// cambios. Rutas relativas: se sirve desde una subruta de GitHub Pages.

const VERSION = 'v2';
const APP_CACHE = 'running-app-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/storage.js',
  './js/state.js',
  './js/schedule.js',
  './js/zones.js',
  './js/pace.js',
  './js/format.js',
  './js/plan.js',
  './js/suggestions.js',
  './js/modal.js',
  './js/ui/components.js',
  './js/ui/today.js',
  './js/ui/plan-view.js',
  './js/ui/session.js',
  './js/ui/history.js',
  './js/ui/progress.js',
  './js/ui/zones.js',
  './js/ui/settings.js',
  './js/ui/block-editor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== APP_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (err) {
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
