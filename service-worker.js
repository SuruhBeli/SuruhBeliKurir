const CACHE_NAME = "suruhbeliKurir-v5";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./index.css",
  "./index.js",
  "./chat.js",
  "./manifest.json",
  "./ikon-192.png",
  "./ikon-512.png"
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  console.log("✅ SW Installed");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  console.log("🚀 SW Activated");

  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// ===== FETCH =====
self.addEventListener("fetch", (event) => {

  const req = event.request;

  // 🔥 Firebase / API → selalu network
  if (req.url.includes("firebase") || req.url.includes("googleapis")) {
    event.respondWith(fetch(req));
    return;
  }

  // ===== HTML → NETWORK FIRST =====
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ===== STATIC → CACHE FIRST =====
  event.respondWith(
    caches.match(req).then(cached => {
      return (
        cached ||
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
      );
    })
  );

});