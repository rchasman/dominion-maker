// Card art moved to hashed /assets/ URLs, so the old card cache is useless.
// This worker replaces the one already installed in returning browsers:
// it clears that cache, unregisters itself, and reloads the open tabs.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => Promise.all(clients.map(c => c.navigate(c.url)))),
  );
});
