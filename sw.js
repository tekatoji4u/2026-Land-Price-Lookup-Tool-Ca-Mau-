// Cho phép dùng khi mất mạng: phục vụ từ bộ nhớ đệm, đồng thời cập nhật ngầm khi có mạng.
// Tăng VERSION mỗi khi đổi danh sách tệp cần lưu sẵn.
const VERSION = 'v4';
const CACHE = 'gia-dat-ca-mau-' + VERSION;
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'data.json', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, {ignoreSearch:true});
    const network = fetch(e.request).then(res => {
      if(res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
