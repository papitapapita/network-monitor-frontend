// Mi Red Control's service worker: shows the alerts the backend pushes to this
// phone (NOT-220…228) and opens the page each one points at. It caches
// nothing — the dashboard is live data, and a stale copy of it would mislead.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// PushPayload (BACKEND_API.md): { title, body, url, tag, urgent }. The title
// already carries its icon; a later push with the same tag replaces this one,
// so a recovery takes the outage's place instead of stacking under it.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const p = event.data.json();
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      renotify: true,
      requireInteraction: Boolean(p.urgent),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: p.url || '/' },
    })
  );
});

// A tap brings an already-open dashboard forward on the alert's page rather
// than stacking a second window over it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      // navigate() refuses a window this worker doesn't control yet.
      if (open) return open.focus().then((w) => (w ?? open).navigate(url)).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    })
  );
});
