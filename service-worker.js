
/* Service Worker minimale */
self.addEventListener("install", () => {
  // Potremo aggiungere precache in futuro
  self.skipWaiting && self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim?.());
});
self.addEventListener("fetch", () => {
  // Strategia offline semplice da aggiungere quando servono asset
});
