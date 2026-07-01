const CACHE_NAME = 'beltfind-v3';
const STATIC_CACHE = 'beltfind-static-v3';
const CDN_CACHE = 'beltfind-cdn-v3';

const APP_FILES = [
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// نصب: کش فایل‌های اصلی
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => 
        cache.addAll(APP_FILES).catch(err => console.warn('Static cache partial fail:', err))
      ),
      caches.open(CDN_CACHE).then(cache =>
        cache.addAll(CDN_FILES).catch(err => console.warn('CDN cache partial fail:', err))
      )
    ]).then(() => self.skipWaiting())
  );
});

// فعال‌سازی: پاک کردن کش‌های قدیمی
self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, CDN_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => !validCaches.includes(k)).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// درخواست‌ها
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isCDN = url.hostname.includes('jsdelivr.net') || 
                url.hostname.includes('cloudflare.com') ||
                url.hostname.includes('supabase.co') === false &&
                url.hostname.includes('googleapis.com');

  // Supabase API — همیشه از شبکه
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  if (isLocal) {
    // Network-First برای فایل‌های اپ
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (isCDN) {
    // Cache-First برای CDN
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CDN_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// پیام آپدیت به کلاینت
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
