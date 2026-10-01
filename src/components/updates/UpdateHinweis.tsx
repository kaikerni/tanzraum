"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { TANZRAUM_BUILD_ID, TANZRAUM_VERSION } from "@/lib/version";

const PRUEF_ABSTAND = 10 * 60 * 1000;

// Dezenter Hinweis, nie blockierend:
// - „geladen“: diese Person nutzt jetzt eine neue Versionsnummer (einmal je Geraet)
// - „server“: der Tab ist schon laenger offen und auf dem Server laeuft inzwischen ein neuer Build -> neu laden
export function UpdateHinweis() {
  const [art, setArt] = useState<null | "geladen" | "server">(null);

  useEffect(() => {
    try {
      const vorher = localStorage.getItem("tr_version");
      if (vorher && vorher !== TANZRAUM_VERSION) setArt("geladen");
      localStorage.setItem("tr_version", TANZRAUM_VERSION);
    } catch {
      /* ohne Speicher kein Hinweis */
    }
    if (TANZRAUM_BUILD_ID === "lokal") return;

    let aktiv = true;
    async function pruefen() {
      if (document.visibilityState !== "visible") return;
      try {
        const antwort = await fetch("/api/version", { cache: "no-store" });
        if (!antwort.ok) return;
        const daten = (await antwort.json()) as { buildId?: string };
        if (!aktiv || !daten.buildId || daten.buildId === TANZRAUM_BUILD_ID) return;
        if (sessionStorage.getItem("tr_update_weg") === daten.buildId) return;
        sessionStorage.setItem("tr_update_server", daten.buildId);
        setArt("server");
      } catch {
        /* offline – spaeter erneut */
      }
    }
    const zeit = window.setInterval(pruefen, PRUEF_ABSTAND);
    document.addEventListener("visibilitychange", pruefen);
    return () => {
      aktiv = false;
      window.clearInterval(zeit);
      document.removeEventListener("visibilitychange", pruefen);
    };
  }, []);

  if (!art) return null;

  function weg() {
    try {
      const id = sessionStorage.getItem("tr_update_server");
      if (id) sessionStorage.setItem("tr_update_weg", id);
    } catch {
      /* egal */
    }
    setArt(null);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 mx-auto flex max-w-[520px] flex-wrap items-center gap-2 rounded-2xl border border-brand-gold-light bg-white px-3.5 py-2.5 shadow-[var(--shadow-hover)] md:bottom-5 md:left-auto md:right-5 md:mx-0"
    >
      <Sparkles size={18} className="shrink-0 text-brand-gold" />
      <p className="min-w-0 flex-1 basis-[calc(100%-80px)] text-[13.5px] font-semibold text-brand-ink sm:basis-auto">
        {art === "server" ? "Eine neue TanzRaum-Version ist da." : `TanzRaum wurde aktualisiert (Version ${TANZRAUM_VERSION}).`}
      </p>
      <button type="button" onClick={weg} aria-label="Hinweis schließen" className="order-none flex h-9 w-9 shrink-0 sm:order-last items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-bg">
        <X size={16} />
      </button>
      {art === "server" ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-brand-ink px-3 text-[12.5px] font-semibold text-white hover:bg-brand-navy"
        >
          Neu laden
        </button>
      ) : null}
      <a
        href="/dashboard/neu"
        onClick={() => setArt(null)}
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg"
      >
        Was ist neu?
      </a>

    </div>
  );
}
