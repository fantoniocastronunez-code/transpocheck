// Este archivo permite que Android muestre notificaciones nativas de la web
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});