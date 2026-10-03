"use client";

import { useEffect } from "react";

// Meldet Service Worker ab, die nicht zu TanzRaum gehoeren (z. B. "/service-worker.js" eines frueheren
// Web-Auftritts auf dieser Domain). Solche Worker koennen alte, zwischengespeicherte Seiten ausliefern; deren
// Formulare passen nicht mehr zum aktuellen Stand. Der eigene Worker /sw.js (Push) bleibt unberuehrt.
export function ServiceWorkerAufraeumen() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      const registrierungen = await navigator.serviceWorker.getRegistrations();
      let entfernt = false;
      for (const reg of registrierungen) {
        const skript = (reg.active ?? reg.waiting ?? reg.installing)?.scriptURL;
        if (skript && new URL(skript).pathname !== "/sw.js") {
          entfernt = (await reg.unregister()) || entfernt;
        }
      }
      // Wurde diese Seite noch vom fremden Worker ausgeliefert, einmal frisch vom Server laden
      const steuernd = navigator.serviceWorker.controller?.scriptURL;
      if (entfernt && steuernd && new URL(steuernd).pathname !== "/sw.js") {
        try {
          if (sessionStorage.getItem("tanzraum-sw-bereinigt")) return;
          sessionStorage.setItem("tanzraum-sw-bereinigt", "1");
        } catch {
          return;
        }
        window.location.reload();
      }
    })().catch(() => {
      /* ohne Service-Worker-Zugriff (z. B. privater Modus) nichts zu tun */
    });
  }, []);
  return null;
}
