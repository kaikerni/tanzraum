"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, User, X, MapPin } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import type { MapPunkt } from "@/lib/netzwerk/tanzraumNetzwerk";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

// Kartenstil: OpenFreeMap (OpenStreetMap-Daten, ohne Schluessel), farblich an TanzRaum angepasst
const STIL = "https://tiles.openfreemap.org/styles/positron";
const DEUTSCHLAND: [number, number] = [10.45, 51.16];

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

export function NetzwerkMap({ punkte, fokusVerein, ichAufMap }: { punkte: MapPunkt[]; fokusVerein?: string; ichAufMap: boolean }) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MLMap | null>(null);
  const marker = useRef<Marker[]>([]);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [zeigeVereine, setZeigeVereine] = useState(true);
  const [zeigePersonen, setZeigePersonen] = useState(true);
  const [auswahl, setAuswahl] = useState<MapPunkt | null>(() => punkte.find((p) => p.art === "verein" && p.id === fokusVerein) ?? null);

  const sichtbar = useMemo(
    () => punkte.filter((p) => (p.art === "verein" ? zeigeVereine : zeigePersonen)),
    [punkte, zeigeVereine, zeigePersonen],
  );
  const anzahl = { vereine: punkte.filter((p) => p.art === "verein").length, personen: punkte.filter((p) => p.art === "person").length };

  // Karte einmalig erzeugen
  useEffect(() => {
    let abbruch = false;
    (async () => {
      try {
        const maplibre = (await import("maplibre-gl")).default;
        if (abbruch || !behaelter.current) return;
        const m = new maplibre.Map({
          container: behaelter.current,
          style: STIL,
          center: DEUTSCHLAND,
          zoom: 5.2,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        m.on("load", () => {
          // TanzRaum-Farbwelt: warmer Hintergrund, zartes Wasser
          for (const layer of m.getStyle().layers ?? []) {
            try {
              if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", "#faf7f4");
              else if (layer.type === "fill" && /water/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", "#dde8f3");
              else if (layer.type === "fill" && /(park|wood|grass|landcover)/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", "#eef3ea");
              else if (layer.type === "line" && /boundary/.test(layer.id)) m.setPaintProperty(layer.id, "line-color", "#e8b7bc");
            } catch {
              // einzelne Ebenen ohne diese Eigenschaft ignorieren
            }
          }
          setBereit(true);
        });
        m.on("error", (e) => {
          if (!m.loaded() && String(e.error?.message ?? "").includes("Failed to fetch")) setFehler(true);
        });
        karte.current = m;
      } catch {
        setFehler(true);
      }
    })();
    return () => {
      abbruch = true;
      karte.current?.remove();
      karte.current = null;
    };
  }, []);

  // Marker setzen
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    let aktiv = true;
    (async () => {
      const maplibre = (await import("maplibre-gl")).default;
      if (!aktiv) return;
      marker.current.forEach((mk) => mk.remove());
      marker.current = sichtbar.map((p) => {
        const [dx, dy] = p.art === "person" ? versatz(p.id) : [0, 0];
        const el = markerElement(p, auswahl?.id === p.id);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setAuswahl(p);
        });
        return new maplibre.Marker({ element: el, anchor: p.art === "verein" ? "bottom" : "center" })
          .setLngLat([p.lng + dx, p.lat + dy])
          .addTo(m);
      });
    })();
    return () => {
      aktiv = false;
    };
  }, [sichtbar, bereit, auswahl]);

  // Ausschnitt: Fokus-Verein oder alle Punkte
  useEffect(() => {
    const m = karte.current;
    if (!m || !bereit) return;
    const fokus = punkte.find((p) => p.art === "verein" && p.id === fokusVerein);
    if (fokus) {
      m.jumpTo({ center: [fokus.lng, fokus.lat], zoom: 11 });
      return;
    }
    if (punkte.length === 0) return;
    const lngs = punkte.map((p) => p.lng);
    const lats = punkte.map((p) => p.lat);
    if (punkte.length === 1) m.jumpTo({ center: [lngs[0], lats[0]], zoom: 9 });
    else
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 11, duration: 0 },
      );
  }, [bereit, punkte, fokusVerein]);

  const chip = (an: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold shadow-sm transition-colors ${
      an ? "border-brand-red bg-white text-brand-ink" : "border-brand-line bg-white/80 text-brand-ink-faint line-through"
    }`;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-[#faf7f4] shadow-[var(--shadow)]">
      <div ref={behaelter} className="h-[calc(100dvh-260px)] min-h-[420px] w-full" onClick={() => setAuswahl(null)} />

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

      {fehler && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#faf7f4] p-6 text-center text-[13.5px] text-brand-ink-soft">
          Die Karte konnte gerade nicht geladen werden. Bitte prüfe deine Internetverbindung oder nutze die Listenansicht.
        </div>
      )}

      {!ichAufMap && !auswahl && (
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
  );
}
