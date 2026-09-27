"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, User, X, MapPin, Map as MapIcon } from "lucide-react";
import type { MapPunkt } from "@/lib/netzwerk/tanzraumNetzwerk";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

// Karte: Google Maps (Maps JavaScript API). Geladen wird erst nach Klick auf "Karte laden" (Daten gehen an Google),
// auf Wunsch fuer dieses Geraet gemerkt. Der Browser-Schluessel kommt zur Laufzeit vom Server (GOOGLE_MAPS_BROWSER_KEY).
const MERKEN = "tanzraum-google-maps";
const DEUTSCHLAND = { lat: 51.16, lng: 10.45 };

// TanzRaum-Farbwelt: warmer Hintergrund, zartes Wasser, ohne Geschaefte/OePNV-Symbole
const STIL: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#faf7f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6272" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dde8f3" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#eef3ea" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f3e6dc" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#e8b7bc" }] },
];

type Bibliothek = { Map: typeof google.maps.Map; OverlayView: typeof google.maps.OverlayView; LatLngBounds: typeof google.maps.LatLngBounds };
let ladevorgang: Promise<Bibliothek> | null = null;

function googleMapsLaden(schluessel: string): Promise<Bibliothek> {
  if (ladevorgang) return ladevorgang;
  ladevorgang = new Promise<Bibliothek>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    w.__tanzraumKarteBereit = async () => {
      try {
        const { Map, OverlayView } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        const { LatLngBounds } = (await google.maps.importLibrary("core")) as google.maps.CoreLibrary;
        resolve({ Map, OverlayView, LatLngBounds });
      } catch (e) {
        reject(e);
      }
    };
    const skript = document.createElement("script");
    skript.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(schluessel)}&v=weekly&language=de&region=DE&loading=async&callback=__tanzraumKarteBereit`;
    skript.async = true;
    skript.onerror = () => {
      ladevorgang = null;
      skript.remove();
      reject(new Error("Google Maps nicht erreichbar"));
    };
    document.head.appendChild(skript);
  });
  return ladevorgang;
}

// Eigene HTML-Marker (TanzRaum-Optik) als OverlayView – braucht keine Map-ID
type HtmlMarker = google.maps.OverlayView;
function htmlMarker(bib: Bibliothek, position: google.maps.LatLngLiteral, el: HTMLElement, unten: boolean): HtmlMarker {
  class Marker extends bib.OverlayView {
    onAdd() {
      el.style.position = "absolute";
      bib.OverlayView.preventMapHitsAndGesturesFrom(el);
      this.getPanes()?.overlayMouseTarget.appendChild(el);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(position);
      if (!p) return;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.transform = unten ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
    }
    onRemove() {
      el.remove();
    }
  }
  return new Marker();
}

// Gleiche Orte leicht versetzen, damit Mitglieder aus einem Ort nicht exakt uebereinander liegen
function versatz(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return [((h & 0xff) / 255 - 0.5) * 0.012, (((h >> 8) & 0xff) / 255 - 0.5) * 0.008];
}

const HAUS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

const FARBWERT: Record<string, string> = {
  "bg-brand-red": "#e11d2e",
  "bg-brand-blue": "#1f6feb",
  "bg-brand-green": "#1f9d55",
  "bg-brand-purple": "#5b3fd1",
  "bg-brand-gold": "#c9921f",
  "bg-brand-navy-soft": "#3b4356",
};

function markerElement(p: MapPunkt, aktiv: boolean): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${p.art === "verein" ? "Verein" : "Mitglied"}: ${p.name}`);
  el.style.cursor = "pointer";
  el.style.border = "none";
  el.style.padding = "0";
  el.style.background = "transparent";
  if (p.art === "verein") {
    const innen = p.avatarUrl
      ? `<img src="${encodeURI(p.avatarUrl)}" alt="" style="width:30px;height:30px;border-radius:9999px;object-fit:cover;background:white"/>`
      : HAUS;
    el.innerHTML = `<span style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 5px rgba(27,33,48,.28));transform:scale(${aktiv ? 1.15 : 1});transition:transform .15s">
      <span style="display:flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:9999px;background:#e11d2e;border:3px solid ${aktiv ? "#c9921f" : "white"}">${innen}</span>
      <span style="width:0;height:0;margin-top:-2px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid #e11d2e"></span>
    </span>`;
  } else {
    const farbe = FARBWERT[farbeFuer(p.name)] ?? "#3b4356";
    const innen = p.avatarUrl
      ? `<img src="${encodeURI(p.avatarUrl)}" alt="" style="width:100%;height:100%;border-radius:9999px;object-fit:cover"/>`
      : `<span style="font:700 12px/1 system-ui,sans-serif;color:white">${initialen(p.name).replace(/[<>&"]/g, "")}</span>`;
    el.innerHTML = `<span style="display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:9999px;background:${farbe};border:2.5px solid ${aktiv ? "#e11d2e" : "#c9921f"};box-shadow:0 2px 6px rgba(27,33,48,.25);transform:scale(${aktiv ? 1.15 : 1});transition:transform .15s">${innen}</span>`;
  }
  return el;
}

export function NetzwerkMap({
  punkte,
  fokusVerein,
  ichAufMap,
  schluessel,
}: {
  punkte: MapPunkt[];
  fokusVerein?: string;
  ichAufMap: boolean;
  schluessel: string;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<google.maps.Map | null>(null);
  const bibliothek = useRef<Bibliothek | null>(null);
  const marker = useRef<HtmlMarker[]>([]);
  const [erlaubt, setErlaubt] = useState(false);
  const [gemerkt, setGemerkt] = useState(false);
  const [merken, setMerken] = useState(false);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<"" | "laden" | "schluessel">("");
  const [zeigeVereine, setZeigeVereine] = useState(true);
  const [zeigePersonen, setZeigePersonen] = useState(true);
  const [auswahl, setAuswahl] = useState<MapPunkt | null>(() => punkte.find((p) => p.art === "verein" && p.id === fokusVerein) ?? null);

  const sichtbar = useMemo(
    () => punkte.filter((p) => (p.art === "verein" ? zeigeVereine : zeigePersonen)),
    [punkte, zeigeVereine, zeigePersonen],
  );
  const anzahl = { vereine: punkte.filter((p) => p.art === "verein").length, personen: punkte.filter((p) => p.art === "person").length };

  // Gemerkte Zustimmung (nur auf diesem Geraet)
  useEffect(() => {
    try {
      if (localStorage.getItem(MERKEN) === "ja") {
        setGemerkt(true);
        setErlaubt(true);
      }
    } catch {
      // ohne Speicher: jedes Mal fragen
    }
  }, []);

  function kartenLadenErlauben() {
    if (merken) {
      try {
        localStorage.setItem(MERKEN, "ja");
        setGemerkt(true);
      } catch {
        // nicht merkbar – laedt trotzdem fuer diesen Besuch
      }
    }
    setErlaubt(true);
  }

  function nichtMehrMerken() {
    try {
      localStorage.removeItem(MERKEN);
    } catch {
      // nichts gespeichert
    }
    setGemerkt(false);
  }

  // Karte erzeugen, sobald erlaubt
  useEffect(() => {
    if (!erlaubt || !schluessel) return;
    let abbruch = false;
    // Google meldet einen ungueltigen/gesperrten Schluessel ueber diese globale Funktion
    (window as unknown as Record<string, unknown>).gm_authFailure = () => setFehler("schluessel");
    googleMapsLaden(schluessel)
      .then((bib) => {
        if (abbruch || !behaelter.current) return;
        bibliothek.current = bib;
        const m = new bib.Map(behaelter.current, {
          center: DEUTSCHLAND,
          zoom: 6,
          styles: STIL,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#faf7f4",
        });
        m.addListener("click", () => setAuswahl(null));
        karte.current = m;
        setBereit(true);
      })
      .catch(() => {
        if (!abbruch) setFehler("laden");
      });
    return () => {
      abbruch = true;
      marker.current.forEach((mk) => mk.setMap(null));
      marker.current = [];
      karte.current = null;
      setBereit(false);
    };
  }, [erlaubt, schluessel]);

  // Marker setzen
  useEffect(() => {
    const m = karte.current;
    const bib = bibliothek.current;
    if (!m || !bib || !bereit) return;
    marker.current.forEach((mk) => mk.setMap(null));
    marker.current = sichtbar.map((p) => {
      const [dx, dy] = p.art === "person" ? versatz(p.id) : [0, 0];
      const el = markerElement(p, auswahl?.id === p.id);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setAuswahl(p);
      });
      const mk = htmlMarker(bib, { lat: p.lat + dy, lng: p.lng + dx }, el, p.art === "verein");
      mk.setMap(m);
      return mk;
    });
  }, [sichtbar, bereit, auswahl]);

  // Ausschnitt: Fokus-Verein oder alle Punkte
  useEffect(() => {
    const m = karte.current;
    const bib = bibliothek.current;
    if (!m || !bib || !bereit) return;
    const fokus = punkte.find((p) => p.art === "verein" && p.id === fokusVerein);
    if (fokus) {
      m.setCenter({ lat: fokus.lat, lng: fokus.lng });
      m.setZoom(12);
      return;
    }
    if (punkte.length === 0) return;
    if (punkte.length === 1) {
      m.setCenter({ lat: punkte[0].lat, lng: punkte[0].lng });
      m.setZoom(10);
      return;
    }
    const grenzen = new bib.LatLngBounds();
    punkte.forEach((p) => grenzen.extend({ lat: p.lat, lng: p.lng }));
    m.fitBounds(grenzen, 60);
    google.maps.event.addListenerOnce(m, "idle", () => {
      if ((m.getZoom() ?? 0) > 12) m.setZoom(12);
    });
  }, [bereit, punkte, fokusVerein]);

  const chip = (an: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold shadow-sm transition-colors ${
      an ? "border-brand-red bg-white text-brand-ink" : "border-brand-line bg-white/80 text-brand-ink-faint line-through"
    }`;

  return (
    <div>
    <div className="relative overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-[#faf7f4] shadow-[var(--shadow)]">
      <div ref={behaelter} className="h-[calc(100dvh-260px)] min-h-[420px] w-full" />

      {!erlaubt && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#faf7f4] p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-red shadow-sm">
              <MapIcon size={24} />
            </span>
            {schluessel ? (
              <>
                <p className="text-[13.5px] text-brand-ink-soft">
                  Die Karte wird von Google Maps bereitgestellt. Beim Laden überträgt dein Browser Daten, u. a. deine IP-Adresse, an
                  Google. Mehr dazu in der{" "}
                  <Link href="/datenschutz" className="font-semibold text-brand-red">
                    Datenschutzerklärung
                  </Link>
                  .
                </p>
                <button type="button" onClick={kartenLadenErlauben} className="btn-primary min-h-10 px-5 text-[14px]">
                  Karte laden
                </button>
                <label className="flex items-center gap-2 text-[12.5px] text-brand-ink-soft">
                  <input type="checkbox" checked={merken} onChange={(e) => setMerken(e.target.checked)} className="h-4 w-4 accent-[#e11d2e]" />
                  Auf diesem Gerät merken
                </label>
              </>
            ) : (
              <p className="text-[13.5px] text-brand-ink-soft">Die Karte wird gerade eingerichtet. Bis dahin findest du alle Einträge in der Listenansicht.</p>
            )}
            <Link href="/dashboard/netzwerk?ansicht=liste" className="text-[13px] font-semibold text-brand-red">
              Zur Listenansicht
            </Link>
          </div>
        </div>
      )}

      {bereit && (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setZeigeVereine(!zeigeVereine)} className={`pointer-events-auto ${chip(zeigeVereine)}`} aria-pressed={zeigeVereine}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-red text-white">
            <Building2 size={10} />
          </span>
          Vereine · {anzahl.vereine}
        </button>
        <button type="button" onClick={() => setZeigePersonen(!zeigePersonen)} className={`pointer-events-auto ${chip(zeigePersonen)}`} aria-pressed={zeigePersonen}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand-gold bg-brand-navy-soft text-white">
            <User size={9} />
          </span>
          Mitglieder · {anzahl.personen}
        </button>
      </div>
      )}

      {fehler && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#faf7f4] p-6 text-center text-[13.5px] text-brand-ink-soft">
          {fehler === "schluessel"
            ? "Die Karte ist gerade nicht verfügbar. Bitte nutze die Listenansicht."
            : "Die Karte konnte gerade nicht geladen werden. Bitte prüfe deine Internetverbindung oder nutze die Listenansicht."}
        </div>
      )}

      {bereit && !ichAufMap && !auswahl && (
        <Link
          href="/dashboard/einstellungen#map"
          className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-[12.5px] text-brand-ink-soft shadow-md sm:right-auto"
        >
          <MapPin size={15} className="shrink-0 text-brand-red" />
          Du bist nicht auf der Map. <span className="font-semibold text-brand-red">Mit deinem Ort zeigen?</span>
        </Link>
      )}

      {auswahl && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl border border-brand-line bg-white p-3 shadow-lg sm:left-auto sm:w-[340px]">
          {auswahl.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auswahl.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${auswahl.art === "verein" ? "bg-brand-red" : farbeFuer(auswahl.name)}`}
            >
              {auswahl.art === "verein" ? <Building2 size={22} /> : <span className="text-[15px] font-bold">{initialen(auswahl.name)}</span>}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-brand-ink">{auswahl.name}</p>
            {auswahl.zeile && <p className="truncate text-[12.5px] text-brand-ink-soft">{auswahl.zeile}</p>}
            <Link
              href={auswahl.art === "verein" ? `/dashboard/netzwerk/verein/${auswahl.id}` : `/dashboard/netzwerk/person/${auswahl.id}`}
              className="mt-1 inline-flex text-[13px] font-semibold text-brand-red"
            >
              {auswahl.art === "verein" ? "Vereinsprofil ansehen" : "Profil ansehen"} →
            </Link>
          </div>
          <button type="button" onClick={() => setAuswahl(null)} aria-label="Schließen" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-brand-bg">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
    {gemerkt && (
      <button type="button" onClick={nichtMehrMerken} className="mt-2 text-[12px] text-brand-ink-faint underline-offset-2 hover:underline">
        Google Maps auf diesem Gerät nicht mehr automatisch laden
      </button>
    )}
    </div>
  );
}
