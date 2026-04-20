// firebase-messaging-sw.js (RAÍZ)
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js",
);

// console.log('🔧 [SW-Firebase] Service Worker cargado');

firebase.initializeApp({
  apiKey: "AIzaSyDoVSYZvO_ew5ySaN7981J8S6rxV1aCwrQ",
  authDomain: "gozartechat.firebaseapp.com",
  databaseURL: "https://gozartechat-default-rtdb.firebaseio.com",
  projectId: "gozartechat",
  storageBucket: "gozartechat.firebasestorage.app",
  messagingSenderId: "845903029009",
  appId: "1:845903029009:web:dc28a9f7435a7a1b9c62b0",
  measurementId: "G-SWY2WZGQJ5",
});

const messaging = firebase.messaging();
// console.log('✅ [SW-Firebase] Messaging inicializado');

messaging.onBackgroundMessage((payload) => {
  //   console.log("📩 [SW-Firebase] Mensaje en background:", payload);

  const notificationTitle = payload.notification?.title || "Gozarte RDP";
    const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || "/assets/images/LogosRDP.webp",
    badge: "/assets/images/LogosRDP.webp",
    vibrate: [200, 100, 200],
    data: {
        url: "/"
    },
    actions: [
        {
        action: 'open',
        title: 'Abrir GozarteRDP',
        }
    ]
    };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});


