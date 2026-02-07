/* =====================================================
   Cache Configuration
===================================================== */

/**
 * Cache version name
 * IMPORTANT:
 * Change this value whenever you update files
 * Example: v1 → v2 → v3
 * This forces old caches to be deleted
 */
const CACHE_NAME = "laundry-tracker-v8";

/**
 * Files that should be cached for offline use
 * These are the "app shell" files
 * The app can load without internet if these exist
 */
const FILES_TO_CACHE = [
  "/",                // Root path
  "./",              // Current directory
  "./index.html",   // Main HTML file
  "./style.css",    // Styles
  "./app.js",       // App logic
  "./manifest.json"
];

/* =====================================================
   Install Event
===================================================== */

/**
 * Fires when the service worker is first installed
 * This is where we:
 * - Open a cache
 * - Store all required app files
 */
self.addEventListener("install", event => {
  console.log("[Service Worker] Installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[Service Worker] Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

/* =====================================================
   Activate Event
===================================================== */

/**
 * Fires when a new service worker takes control
 * Used to:
 * - Delete old caches
 * - Keep storage clean
 */
self.addEventListener("activate", event => {
  console.log("[Service Worker] Activating...");

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

/* =====================================================
   Fetch Event
===================================================== */

/**
 * Intercepts all network requests
 * Strategy: Cache First
 *
 * 1. Try cache
 * 2. If not found, fetch from network
 * 3. If network fails, app still works offline
 */
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Otherwise fetch from network
      return fetch(event.request).catch(() => {
        // Optional:
        // You could return a custom offline page here
        return new Response("Offline", {
          status: 503,
          statusText: "Offline"
        });
      });
    })
  );
});
