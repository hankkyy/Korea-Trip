// 在璐上 — only public, same-origin application resources belong in offline cache.
const VERSION = 'lu-travel-v81';
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const CACHE = `${VERSION}:${SCOPE_PATH}`;
const APP_SHELL = SCOPE_PATH === '/korea/' ? '/korea/index.html' : '/';
const PUBLIC_ASSET = /\.(?:js|css|webp|png|jpg|jpeg|svg|woff2?|ico)$/i;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    APP_SHELL, '/assets/sync-client.js', '/assets/vendor/cloudbase.full.js'
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key.startsWith('lu-travel-') && key !== CACHE &&
    (!key.includes(':') || key.endsWith(`:${SCOPE_PATH}`))
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/(?:private|docs|api)\//.test(url.pathname) || url.searchParams.has('sign')) return;
  if (SCOPE_PATH === '/' && url.pathname.startsWith('/korea/')) return;
  const navigation = event.request.mode === 'navigate' && [SCOPE_PATH, APP_SHELL, `${SCOPE_PATH}index.html`].includes(url.pathname);
  const asset = url.pathname.startsWith('/assets/') && PUBLIC_ASSET.test(url.pathname) || url.pathname === '/manifest.json';
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = navigation ? APP_SHELL : event.request;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque') await cache.put(key, response.clone());
      return response;
    } catch {
      return await cache.match(key) || new Response('离线时无法读取此资源，请联网重试。', { status: 503 });
    }
  })());
});
