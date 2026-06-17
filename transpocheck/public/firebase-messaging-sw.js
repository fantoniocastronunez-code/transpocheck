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
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});