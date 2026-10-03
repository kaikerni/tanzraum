// Abschalt-Service-Worker fuer einen ALTEN Service Worker ("/service-worker.js") eines frueheren Web-Auftritts
// auf dieser Domain. TanzRaum selbst nutzt nur /sw.js (Push-Benachrichtigungen).
// Browser pruefen registrierte Service Worker regelmaessig auf Aktualisierungen. Findet ein Browser hier diese
// Datei, ersetzt sie den alten Worker, leert dessen Zwischenspeicher, meldet sich ab und laedt offene Seiten neu –
// danach kommen alle Seiten wieder direkt vom Server. Nicht loeschen, solange alte Besucher denkbar sind.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // TanzRaum legt keine Cache-Storage-Eintraege an; alles hier stammt vom alten Worker
      const namen = await caches.keys();
      await Promise.all(namen.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const f of fenster) {
        try {
          await f.navigate(f.url);
        } catch (e) {
          /* Fenster einer anderen Seite */
        }
      }
    })(),
  );
});
