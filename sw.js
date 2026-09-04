// Korea Trip — Service Worker
// 目的：Add to Home Screen 后离线也能打开壳，弱网下用缓存兜底
const CACHE = 'korea-trip-v5';
const PRECACHE = [
  '/',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/photos/seoul-watercolor.webp',
  '/assets/photos/busan-watercolor.webp',
  '/assets/photos/palace-watercolor.webp',
  '/assets/photos/seoul-editorial.webp',
  '/assets/photos/busan-editorial.webp',
  '/assets/photos/seoul-palace-editorial.png',
  '/assets/photos/busan-harbor-editorial.png',
  '/assets/photos/busan-village-editorial.png',
  '/assets/photos/seoul-night-editorial.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API 请求不缓存，直连
  if (url.hostname.includes('tcloudbase.com')) return;

  // 页面导航：网络优先，失败回退缓存（离线打开 App 壳）
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 静态资源：缓存优先 + 后台更新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
