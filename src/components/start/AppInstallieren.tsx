"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";

// „App installieren“: TanzRaum ist eine Web-App (PWA) – kein App Store nötig.
// Android/Chrome/Edge: echter Installationsdialog des Browsers. iPhone/iPad: Anleitung (Safari bietet keinen Dialog).

type InstallEreignis = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Zustand = "pruefen" | "bereit" | "ios" | "installiert" | "anleitung";

export function AppInstallieren({ variante = "gross" }: { variante?: "gross" | "klein" }) {
  const [zustand, setZustand] = useState<Zustand>("pruefen");
  const [ereignis, setEreignis] = useState<InstallEreignis | null>(null);
  const [iosHinweis, setIosHinweis] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return setZustand("installiert");
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setZustand(ios ? "ios" : "anleitung");

    // Push-Service-Worker registrieren (macht TanzRaum in allen Browsern installierbar)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);

    const bereit = (e: Event) => {
      e.preventDefault();
      setEreignis(e as InstallEreignis);
      setZustand("bereit");
    };
    const fertig = () => setZustand("installiert");
    window.addEventListener("beforeinstallprompt", bereit);
    window.addEventListener("appinstalled", fertig);
    return () => {
      window.removeEventListener("beforeinstallprompt", bereit);
      window.removeEventListener("appinstalled", fertig);
    };
  }, []);

  async function installieren() {
    if (!ereignis) return;
    await ereignis.prompt();
    const wahl = await ereignis.userChoice;
    if (wahl.outcome === "accepted") setZustand("installiert");
    setEreignis(null);
  }

  const gross = variante === "gross";
  const knopf = gross
    ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-ink px-6 text-[15px] font-bold text-white hover:bg-brand-navy"
    : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-5 text-[15px] font-bold text-brand-ink hover:bg-brand-bg";

  if (zustand === "pruefen") return null;
  if (zustand === "installiert") {
    return (
      <span className={`inline-flex items-center gap-2 font-semibold text-brand-green ${gross ? "text-[15px]" : "text-[14px]"}`}>
        <CheckCircle2 size={18} /> TanzRaum ist auf diesem Gerät installiert
      </span>
    );
  }
  if (zustand === "bereit") {
    return (
      <button type="button" onClick={installieren} className={knopf}>
        <Download size={18} /> App installieren
      </button>
    );
  }
  if (zustand === "ios") {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={() => setIosHinweis((v) => !v)} className={knopf} aria-expanded={iosHinweis}>
          <Smartphone size={18} /> App installieren
        </button>
        {iosHinweis && (
          <p className="max-w-sm rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13.5px] text-brand-ink">
            In Safari unten auf <Share size={14} className="inline -translate-y-0.5" /> <strong>Teilen</strong> tippen, dann{" "}
            <strong>„Zum Home-Bildschirm“</strong> und <strong>„Hinzufügen“</strong>.
          </p>
        )}
      </div>
    );
  }
  // Browser ohne Installationsdialog (z. B. Firefox, oder Chrome zeigt ihn erst später): zur Anleitung
  return (
    <a href="#app" className={knopf}>
      <Smartphone size={18} /> App aufs Smartphone
    </a>
  );
}
