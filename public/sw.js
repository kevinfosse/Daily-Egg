// PokéDaily Service Worker - Push Notifications

const CACHE_NAME = 'pokedaily-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'PokéDaily',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || 'Votre oeuf journalier est prêt !',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    tag: 'pokedaily-egg-ready',
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
      },
      {
        action: 'dismiss',
        title: 'Plus tard',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PokéDaily', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Analytics or cleanup if needed
});
