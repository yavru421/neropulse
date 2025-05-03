const CACHE_NAME = 'neuropulse-v1.2'; // Increment version for updates
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
    }).then(() => {
      // After clearing old caches, notify clients about the update
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: CACHE_NAME
          });
        });
      });
    })
  );
  
  // Claim clients to ensure the SW controls all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network with network-first strategy for API endpoints
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Network-first strategy for API endpoints
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone response to store in cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Cache-first strategy for other requests
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
            // Return offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('[Service Worker] Push received but no data');
    return;
  }
  
  try {
    const data = event.data.json();
    
    const title = data.title || 'NeuroPulse';
    const options = {
      body: data.message || 'You have a new message',
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-192x192.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        timestamp: data.timestamp || Date.now(),
        id: data.id || `notification-${Date.now()}`
      },
      actions: data.actions || [
        {
          action: 'view',
          title: 'View'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ],
      // Enable these if needed
      silent: data.silent || false,
      renotify: data.renotify || false,
      tag: data.tag || 'neuropulse-notification' // Tag for grouping notifications
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('[Service Worker] Error showing notification:', error);
  }
});

// Handle notification clicks with better navigation
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action = event.action;
  const notificationData = notification.data;
  
  notification.close();
  
  // Handle specific actions
  if (action === 'close') {
    return; // User chose to close, do nothing
  }
  
  // Default action is to open the specified URL
  const urlToOpen = notificationData.url || '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(windowClients => {
        // Check if there is already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            // Send a message to the client
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              notificationId: notificationData.id,
              timestamp: notificationData.timestamp
            });
            return client.focus();
          }
        }
        
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen).then(client => {
            // We can't send a message here immediately because the window
            // might not be fully loaded, but the app can check for notification
            // parameters in the URL when it loads
          });
        }
      })
  );
});

// Listen for message events (for communication with the client)
self.addEventListener('message', event => {
  // Handle messages from the client
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Return the current version
    event.ports[0].postMessage({
      type: 'UPDATE_STATUS',
      version: CACHE_NAME
    });
  }
});