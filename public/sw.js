// TanzRaum Service Worker: zeigt Chat-Benachrichtigungen an.
// Der Push selbst hat keinen Inhalt; Titel und Vorschau holt der Worker angemeldet vom Server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let info = { titel: "TanzRaum-Messenger", text: "Du hast eine neue Nachricht.", url: "/dashboard/nachrichten", tag: "tanzraum-chat" };
      try {
        const antwort = await fetch("/api/chat/push-info", { credentials: "include", cache: "no-store" });
        if (antwort.ok) info = { ...info, ...(await antwort.json()) };
      } catch (e) {
        /* ohne Vorschau */
      }
      await self.registration.showNotification(info.titel, {
        body: info.text,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: info.tag,
        renotify: true,
        requireInteraction: String(info.tag).startsWith("anruf-"),
        vibrate: String(info.tag).startsWith("anruf-") ? [400, 200, 400, 200, 400] : undefined,
        data: { url: info.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = (event.notification.data && event.notification.data.url) || "/dashboard/nachrichten";
  event.waitUntil(
    (async () => {
      const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const f of fenster) {
        if ("focus" in f) {
          try {
            await f.navigate(ziel);
          } catch (e) {
            /* fremde Seite */
          }
          return f.focus();
        }
      }
      return self.clients.openWindow(ziel);
    })(),
  );
});
