importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyDlX1VY0n5dDEvD_Tyivb0u_DLdfsargfI",
  projectId: "logisticapp-45452",
  messagingSenderId: "522404772814",
  appId: "1:522404772814:web:6ae1154eb945d36475099f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  
  // Extraemos los datos de forma segura (el signo '?' evita que el código se estrelle si algo viene vacío)
  const notificationTitle = payload.notification?.title || payload.data?.title || 'LogisticAPP';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Tienes una nueva actualización.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: '/' } // Guardamos la URL base
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// NUEVO: Esto es CLAVE. Define qué pasa cuando el usuario toca la notificación en su celular.
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Click en la notificación detectado.');
  event.notification.close(); // Cierra la alerta visual de la pantalla
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // 1. Si la app ya está abierta en segundo plano, la trae al frente inmediatamente
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.indexOf(self.registration.scope) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Si la app está totalmente cerrada, la abre desde cero en la ruta principal
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});