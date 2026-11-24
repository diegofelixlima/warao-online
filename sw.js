// Guarda o app no aparelho para funcionar sem internet.
// Ao mudar qualquer arquivo do app, aumente o número da versão abaixo.
const CACHE = 'warao-v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'dados/vocabulario.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Lista de áudios: tenta a rede primeiro para ver gravações novas do repositório.
  if (req.url.endsWith('/audio/index.json')) {
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); return res; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return res;
  })));
});
