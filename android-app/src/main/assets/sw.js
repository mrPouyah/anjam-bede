const CACHE_NAME = 'emrooz-v37';
const APP_FILES = ['./', './index.html', './styles.css?v=37', './app.js?v=37', './subscriptions.js?v=37', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    return; // Do not cache API calls
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    if (windows.length) return windows[0].focus();
    return clients.openWindow('./');
  }));
});
