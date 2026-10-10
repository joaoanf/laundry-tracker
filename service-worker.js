const CACHE_NAME = "laundry-tracker-v10-3";
const PREFIX = "laundry-tracker-v10-";
const SHELL = ["./", "./index.html", "./style.css?v=10.3", "./app.js?v=10.3", "./manifest.json?v=10.3", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL.map(path => new Request(path, { cache: "reload" })))));
});
self.addEventListener("activate", event => {
  // Only remove caches owned by this version; keep older app folders intact.
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === "navigate") return await cache.match("./index.html");
      return new Response("Sem ligação", { status: 503 });
    }
  }));
});
