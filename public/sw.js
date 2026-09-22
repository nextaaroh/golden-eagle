self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Background notification & vibration listener
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "ALARM_TRIGGER") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "/icons/icon-192x192.png",
      vibrate: [500, 250, 500, 250, 1000],
      tag: "fitness-alarm",
      renotify: true,
    });
  }
});
