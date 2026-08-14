// Loaded into the generated Workbox service worker via nuxt.config.ts's
// `pwa.workbox.importScripts`. Handles the two events that only ever fire on
// the service-worker thread -- which is exactly why notifications can arrive
// with the app closed at all.
//
// Plain JS, no imports: this file is served as-is from public/ and is not part
// of the build pipeline. Bump the ?v= in nuxt.config.ts when it changes.
/* eslint-disable no-undef */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "5stack", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "5stack", {
      body: payload.body || "",
      icon: payload.icon || "/favicon/192.png",
      badge: "/favicon/64.png",
      // Lets the OS replace an earlier notification for the same conversation
      // or match instead of stacking one per message.
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

// The type -> route mapping lives in the app's router, so rather than
// duplicating it here in plain JS with no shared source of truth, the API sends
// the destination on the payload. An already-open tab is handed the url and
// navigates client-side; otherwise the app opens straight to it.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "push-notification-click", url });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
