const CACHE_NAME = 'neuropulse-v1.1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css',
  'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.woff2',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/python.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/javascript.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  
  // Claim clients to ensure the SW controls all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests and API requests
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('api.groq.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise, fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response to store in cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Fetch failed:', error);
            // You could return a custom offline page here
          });
      })
  );
});

// Handle push notifications (could be implemented in future)
self.addEventListener('push', event => {
  if (event.data) {
    const notification = event.data.json();
    
    self.registration.showNotification('NeuroPulse', {
      body: notification.message || 'New message from NeuroPulse',
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-192x192.svg',
      vibrate: [100, 50, 100],
      data: {
        url: notification.url || '/'
      }
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(windowClients => {
        // Check if there is already a window open
        for (const client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});