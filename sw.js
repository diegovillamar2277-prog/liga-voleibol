// ============================================================
//  sw.js — Service Worker v3 (offline + push)
// ============================================================
const CACHE_NAME = 'liga-vol-v4';

const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/main.js',
  '/src/auth/auth.js',
  '/src/auth/auth-ui.js',
  '/src/admin/admin.js',
  '/src/liga/liga-dashboard.js',
  '/src/liga/public-view.js',
  '/src/lib/supabase.js',
  '/src/lib/db.js',
  '/src/lib/ui.js',
  '/src/lib/offline.js',
  '/src/lib/push.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo manejar GET — ignorar HEAD, POST, etc.
  if (e.request.method !== 'GET') return;

  // Supabase y esm.sh siempre van a la red
  if (url.hostname.includes('supabase.co') || url.hostname.includes('esm.sh')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Archivos propios: Network-first con fallback a caché
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push Notifications
self.addEventListener('push', e => {
  let data = { title: '🏐 Liga Voleibol', body: 'Nuevo partido registrado' };
  try { data = e.data ? e.data.json() : data; } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     '/icons/icon-192.png',
      badge:    '/icons/icon-192.png',
      tag:      'partido-nuevo',
      renotify: true,
      data:     data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client)
            return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
