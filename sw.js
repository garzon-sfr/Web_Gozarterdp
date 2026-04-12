const CACHE_NAME = 'gozarte-v2.2';

// Archivos críticos (solo los que EXISTEN 100%)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './src/css/style.css',
    './src/css/chat.css',
    './src/js/player.js',
    './src/js/modules/chat.js',
    './assets/favicon.png',
    './assets/images/defaul.png'
];

// ===============================
// 🟡 INSTALL
// ===============================
self.addEventListener('install', (event) => {
    console.log('📦 SW: Instalando...');

    self.skipWaiting(); // activar inmediatamente

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 SW: Cacheando assets críticos');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.error('❌ SW: Error cacheando archivos:', err);
            })
    );
});

// ===============================
// 🟢 ACTIVATE
// ===============================
self.addEventListener('activate', (event) => {
    console.log('🧹 SW: Activando...');

    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🗑️ SW: Eliminando caché viejo:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );

    self.clients.claim(); // tomar control inmediato
});

// ===============================
// 🔵 FETCH (estrategia inteligente)
// ===============================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // 🚫 NO cachear streaming ni API
    if (
        url.pathname.includes('/api/') ||
        url.pathname.includes('radio.mp3') ||
        request.destination === 'audio'
    ) {
        return; // dejar que pase directo a red
    }

    // 🔥 Estrategia: Cache First + fallback a red
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request)
                .then((networkResponse) => {
                    // Guardar en cache (solo GET válidos)
                    if (
                        request.method === 'GET' &&
                        networkResponse &&
                        networkResponse.status === 200 &&
                        request.url.startsWith(self.location.origin)
                    ) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }

                    return networkResponse;
                })
                .catch(() => {
                    // 🔌 Offline fallback
                    if (request.destination === 'document') {
                        return caches.match('./index.html');
                    }

                    if (request.destination === 'image') {
                        return caches.match('./assets/images/defaul.png');
                    }
                });
        })
    );
});