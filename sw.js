// sw.js - Unificado (reemplaza tu sw.js actual)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ============ CONFIGURACIÓN DE FIREBASE ============
firebase.initializeApp({
  apiKey: "AIzaSyDoVSYZvO_ew5ySaN7981J8S6rxV1aCwrQ",
  authDomain: "gozartechat.firebaseapp.com",
  databaseURL: "https://gozartechat-default-rtdb.firebaseio.com",
  projectId: "gozartechat",
  storageBucket: "gozartechat.firebasestorage.app",
  messagingSenderId: "845903029009",
  appId: "1:845903029009:web:dc28a9f7435a7a1b9c62b0",
  measurementId: "G-SWY2WZGQJ5"
});

const messaging = firebase.messaging();

// ============ CONFIGURACIÓN DE PWA ============
const CACHE_NAME = 'gozarte-v3.6.1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './src/css/style.css',
    './src/css/chat.css',
    './src/js/player.js',
    './src/js/modules/chat.js',
    './src/js/modules/push-notifications.js',
    './assets/favicon.ico',
    './assets/images/LogosRDP.webp'
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
    console.log('📦 SW: Instalando...');
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // console.log('📦 SW: Cacheando assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch((err) => {
            // console.error('❌ SW: Error cacheando:', err);
        })
    );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
    // console.log('🧹 SW: Activando...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        // console.log('🗑️ SW: Eliminando caché viejo:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (url.pathname.includes('/api/') || url.pathname.includes('radio.mp3') || request.destination === 'audio') {
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then((networkResponse) => {
                if (request.method === 'GET' && networkResponse && networkResponse.status === 200 && request.url.startsWith(self.location.origin)) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }
                if (request.destination === 'image') {
                    return caches.match('./assets/images/LogosRDP.webp');
                }
            });
        })
    );
});

// ============ NOTIFICACIONES EN BACKGROUND ============
messaging.onBackgroundMessage((payload) => {
    // console.log("📩 Mensaje en background:", payload);
    
    const notificationTitle = payload.notification?.title || 'Gozarte RDP';
    const notificationOptions = {
        body: payload.notification?.body || 'Nueva notificación',
        icon: '/assets/images/LogosRDP.webp',
        badge: '/assets/images/LogosRDP.webp',
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || '/',
            clickAction: '/'
        }
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============ CLICK EN NOTIFICACIÓN ============
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});