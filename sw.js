const CACHE_NAME = 'neuropulse-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/python.min.js',
  'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/languages/javascript.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip Groq API calls - we don't want to cache those
  if (event.request.url.includes('api.groq.com')) {
    return;
  }
  
  event.respondWith(
    // Try network first
    fetch(event.request)
      .then((response) => {
        // Clone the response to store in cache and return to browser
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then((cache) => {
            // Only cache successful responses
            if (event.request.method === 'GET' && response.status === 200) {
              cache.put(event.request, responseToCache);
            }
          });
          
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request)
          .then((response) => {
            return response || Promise.reject('no-match');
          });
      })
  );
});