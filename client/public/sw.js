const CACHE_NAME = "together-v3";

// Only our own build output is worth keeping: content-hashed assets, icons
// and the manifest. Cross-origin responses (map tiles, fonts) are opaque —
// each counts ~7 MB against storage quota — and would pile up forever.
function shouldCache(request, response) {
  if (!response || !response.ok || response.type === "opaque") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}
const APP_SHELL = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;

  // Navigation requests (the HTML shell) must always be fetched fresh: it
  // references content-hashed JS/CSS filenames that change on every deploy,
  // so serving a cached HTML page can point at assets that no longer exist
  // on the server, leaving the app stuck on a blank screen. Only fall back
  // to a cached copy when the network is unavailable (offline).
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (shouldCache(event.request, res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Cross-origin requests (map tiles, Google Fonts) just go to the network.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Our own content-hashed JS/CSS, icons and manifest are safe to serve
  // cache-first since their URLs change whenever their content does.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (shouldCache(event.request, res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "Together", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Together", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "together",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
