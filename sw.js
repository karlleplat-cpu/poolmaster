// PoolMaster Service Worker
const CACHE_NAME = 'poolmaster-v3';
const urlsToCache = [
  '/poolmaster/pool.html',
  '/poolmaster/manifest.json',
  '/poolmaster/icon.svg'
];

// Install - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first for HTML, cache first for others
self.addEventListener('fetch', (event) => {
  // Always fetch HTML from network first
  if (event.request.url.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request);
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'PoolMaster', body: 'Nouvelle alerte' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/poolmaster/icon.svg',
    badge: '/poolmaster/icon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'poolmaster-alert',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Voir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('pool.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/poolmaster/pool.html');
        }
      })
  );
});

// Background sync for checking alerts
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_ALERTS') {
    // Trigger alert check
    const data = event.data.payload;
    if (data.alert) {
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/poolmaster/icon.svg',
        badge: '/poolmaster/icon.svg',
        vibrate: [200, 100, 200],
        tag: data.tag,
        requireInteraction: true
      });
    }
  }
});
