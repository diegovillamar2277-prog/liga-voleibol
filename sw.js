// ============================================================
//  sw.js — Service Worker (PWA offline básico)
// ============================================================
const CACHE = 'liga-vol-v4';
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
  '/manifest.json',
];

// Instalar: cachear archivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activar: limpiar cachés viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first para estáticos, network-first para Supabase
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase siempre va a red
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Archivos propios: cache first, luego red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
