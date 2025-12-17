// Service Worker for aggressive card image caching
// Cards never change, so cache them forever for instant repeat visits

const CACHE_NAME = "dominion-cards-v1";
const CARD_URLS = [
  "/cards/Card_back.webp",
  "/cards/Card_back.jpg",
  "/cards/Copper.webp",
  "/cards/Silver.webp",
  "/cards/Gold.webp",
  "/cards/Estate.webp",
  "/cards/Duchy.webp",
  "/cards/Province.webp",
  "/cards/Curse.webp",
  "/cards/Artisan.webp",
  "/cards/Bandit.webp",
  "/cards/Bureaucrat.webp",
  "/cards/Cellar.webp",
  "/cards/Chapel.webp",
  "/cards/Council_Room.webp",
  "/cards/Festival.webp",
  "/cards/Gardens.webp",
  "/cards/Harbinger.webp",
  "/cards/Laboratory.webp",
  "/cards/Library.webp",
  "/cards/Market.webp",
  "/cards/Merchant.webp",
  "/cards/Militia.webp",
  "/cards/Mine.webp",
  "/cards/Moat.webp",
  "/cards/Moneylender.webp",
  "/cards/Poacher.webp",
  "/cards/Remodel.webp",
  "/cards/Sentry.webp",
  "/cards/Smithy.webp",
  "/cards/Throne_Room.webp",
  "/cards/Vassal.webp",
  "/cards/Village.webp",
  "/cards/Witch.webp",
  "/cards/Workshop.webp",
];

// Install: Cache all cards immediately
self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        console.log("[SW] Caching card images");
        return cache.addAll(CARD_URLS);
      })
      .then(() => {
        // Activate immediately
        return self.skipWaiting();
      }),
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name)),
        );
      })
      .then(() => {
        // Take control immediately
        return self.clients.claim();
      }),
  );
});

// Fetch: Cache-first for cards, network-first for everything else
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Cache-first strategy for card images
  if (url.pathname.startsWith("/cards/")) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch and cache it
        return fetch(event.request).then(response => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // Network-first for everything else (HTML, JS, CSS)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    }),
  );
});
