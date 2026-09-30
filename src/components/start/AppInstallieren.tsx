"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";

// „App installieren“: TanzRaum ist eine Web-App (PWA) – kein App Store nötig.
// Je nach Gerät: echter Installationsdialog (Android/Chrome/Edge) oder die passende Anleitung.

type InstallEreignis = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Geraet = "iphone" | "iphone_anderer_browser" | "android" | "mac_safari" | "computer" | "in_app";
type Zustand = "pruefen" | "bereit" | "hinweis" | "installiert";

function geraetErkennen(): Geraet {
  const ua = navigator.userAgent;
  // In-App-Browser (Instagram, Facebook, WhatsApp …) koennen nichts installieren
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok/i.test(ua)) return "in_app";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "iphone_anderer_browser" : "iphone";
  if (/android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|Firefox/i.test(ua)) return "mac_safari";
  return "computer";
}

const HINWEIS: Record<Geraet, React.ReactNode> = {
  iphone: (
    <>
      Unten auf <Share size={14} className="inline -translate-y-0.5" /> <strong>Teilen</strong> tippen, dann <strong>„Zum Home-Bildschirm“</strong> und{" "}
      <strong>„Hinzufügen“</strong>. Push-Benachrichtigungen gibt es auf dem iPhone nur in der installierten App (ab iOS 16.4).
    </>
  ),
  iphone_anderer_browser: (
    <>
      Am zuverlässigsten in <strong>Safari</strong>: tanzraum.app in Safari öffnen, <Share size={14} className="inline -translate-y-0.5" />{" "}
      <strong>Teilen</strong> → <strong>„Zum Home-Bildschirm“</strong>. Ab iOS 16.4 geht das auch über das Teilen-Menü in Chrome oder Edge.
    </>
  ),
  android: (
    <>
      Im Browser-Menü <strong>⋮</strong> auf <strong>„App installieren“</strong> bzw. <strong>„Zum Startbildschirm hinzufügen“</strong> tippen (Chrome, Edge,
      Samsung Internet, Firefox).
    </>
  ),
  mac_safari: (
    <>
      In Safari (ab macOS Sonoma) im Menü <strong>Ablage → „Zum Dock hinzufügen“</strong> wählen. In Chrome oder Edge über das Installations-Symbol in der
      Adressleiste.
    </>
  ),
  computer: (
    <>
      In Chrome oder Edge rechts in der Adressleiste auf das <strong>Installations-Symbol</strong> klicken (oder Menü → „TanzRaum installieren“). Firefox am
      Computer kann keine Web-Apps installieren – TanzRaum läuft dort einfach im Browser.
    </>
  ),
  in_app: (
    <>
      Du bist in einem App-internen Browser (z. B. aus Instagram oder WhatsApp). Öffne tanzraum.app über <strong>„Im Browser öffnen“</strong> in Safari bzw.
      Chrome – dort kannst du TanzRaum installieren.
    </>
  ),
};

export function AppInstallieren({ variante = "gross" }: { variante?: "gross" | "klein" }) {
  const [zustand, setZustand] = useState<Zustand>("pruefen");
  const [geraet, setGeraet] = useState<Geraet>("computer");
  const [ereignis, setEreignis] = useState<InstallEreignis | null>(null);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return setZustand("installiert");
    setGeraet(geraetErkennen());
    setZustand("hinweis");

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
  // Kein Installationsdialog verfuegbar: passende Anleitung fuer dieses Geraet
  return (
    <div className={`flex flex-col gap-2 ${gross ? "items-center" : "items-start"}`}>
      <button type="button" onClick={() => setOffen((v) => !v)} className={knopf} aria-expanded={offen}>
        <Smartphone size={18} /> App installieren
      </button>
      {offen && <p className={`max-w-sm rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13.5px] leading-relaxed text-brand-ink ${gross ? "text-center" : ""}`}>{HINWEIS[geraet]}</p>}
    </div>
  );
}
