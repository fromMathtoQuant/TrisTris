self.addEventListener("install", () => {
  console.log("Service Worker installato");
});

self.addEventListener("fetch", () => {
  // SW minimale: nessuna cache per ora
});
``
