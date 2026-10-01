"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, ChevronUp, ChevronDown, Lock, RotateCcw, Save, Smartphone, Monitor } from "lucide-react";
import { ADMIN_NAV, NAV, type NavEintrag } from "@/lib/navigation";
import { navigationSpeichern } from "@/app/dashboard/einstellungen/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { Dialog } from "@/components/ui/Dialog";

export type NaviPunkt = { href: string; label: string; unterpunkte: { href: string; label: string }[] };

const ICON = new Map<string, NavEintrag["icon"]>([...NAV, ...ADMIN_NAV].map((n) => [n.href, n.icon]));

function Symbol({ href, size = 18 }: { href: string; size?: number }) {
  const Icon = ICON.get(href);
  return Icon ? <Icon size={size} className="shrink-0" /> : null;
}

// Sortierbare Liste: Ziehen am Griff (Maus sofort, Touch nach kurzem Halten) oder „Nach oben/unten“
function SortierListe({ eintraege, onAendern, klein = false }: { eintraege: { href: string; label: string }[]; onAendern: (neu: { href: string; label: string }[]) => void; klein?: boolean }) {
  const [ziehe, setZiehe] = useState<string | null>(null);
  const [versatz, setVersatz] = useState(0);
  const zug = useRef<{ href: string; startY: number; startIndex: number; h: number; index: number } | null>(null);
  const warte = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const liste = useRef<HTMLUListElement>(null);
  const aktuell = useRef(eintraege);
  aktuell.current = eintraege;

  function verschieben(von: number, nach: number) {
    if (nach < 0 || nach >= eintraege.length || von === nach) return;
    const neu = [...eintraege];
    const [x] = neu.splice(von, 1);
    neu.splice(nach, 0, x);
    onAendern(neu);
  }

  function starten(href: string, y: number) {
    const zeilen = liste.current?.querySelectorAll<HTMLElement>(":scope > li");
    const h = zeilen && zeilen.length > 1 ? zeilen[1].getBoundingClientRect().top - zeilen[0].getBoundingClientRect().top : 52;
    const index = aktuell.current.findIndex((e) => e.href === href);
    zug.current = { href, startY: y, startIndex: index, h, index };
    setZiehe(href);
    setVersatz(0);
    if ("vibrate" in navigator) navigator.vibrate?.(10);
  }

  function bewegen(y: number) {
    const z = zug.current;
    if (!z) return;
    const gesamt = y - z.startY;
    const ziel = Math.max(0, Math.min(aktuell.current.length - 1, z.startIndex + Math.round(gesamt / z.h)));
    if (ziel !== z.index) {
      const neu = [...aktuell.current];
      const [x] = neu.splice(z.index, 1);
      neu.splice(ziel, 0, x);
      z.index = ziel;
      onAendern(neu);
    }
    setVersatz(gesamt - (z.index - z.startIndex) * z.h);
  }

  function beenden() {
    if (warte.current) clearTimeout(warte.current.t);
    warte.current = null;
    zug.current = null;
    setZiehe(null);
    setVersatz(0);
  }

  return (
    <ul ref={liste} className="flex flex-col gap-1.5">
      {eintraege.map((e, i) => {
        const aktiv = ziehe === e.href;
        return (
          <li key={e.href} className={`rounded-xl ${aktiv ? "border-2 border-dashed border-brand-gold-light bg-brand-gold-wash/40" : ""}`}>
            <div
              className={`flex items-center gap-2 rounded-xl border bg-white px-2 ${klein ? "min-h-11" : "min-h-12"} ${
                aktiv ? "relative z-10 scale-[1.02] border-brand-gold shadow-[0_12px_28px_-12px_rgba(27,33,48,0.45)]" : "border-brand-line transition-transform duration-150"
              }`}
              style={aktiv ? { transform: `translateY(${versatz}px) scale(1.02)` } : undefined}
            >
              <button
                type="button"
                aria-label={`${e.label} verschieben (ziehen)`}
                className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-brand-ink-faint hover:bg-brand-bg active:cursor-grabbing"
                onPointerDown={(ev) => {
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  if (ev.pointerType === "mouse") return starten(e.href, ev.clientY);
                  // Touch: kurz gedrueckt halten, dann verschieben
                  const t = setTimeout(() => starten(e.href, ev.clientY), 220);
                  warte.current = { t, x: ev.clientX, y: ev.clientY };
                }}
                onPointerMove={(ev) => {
                  if (zug.current) return bewegen(ev.clientY);
                  const w = warte.current;
                  if (w && Math.abs(ev.clientY - w.y) + Math.abs(ev.clientX - w.x) > 10) {
                    clearTimeout(w.t);
                    warte.current = null;
                  }
                }}
                onPointerUp={beenden}
                onPointerCancel={beenden}
              >
                <GripVertical size={18} />
              </button>
              <Symbol href={e.href} size={klein ? 16 : 18} />
              <span className={`min-w-0 flex-1 truncate font-semibold text-brand-ink ${klein ? "text-[13.5px]" : "text-[14.5px]"}`}>{e.label}</span>
              <button type="button" aria-label={`${e.label} nach oben`} title="Nach oben" disabled={i === 0} onClick={() => verschieben(i, i - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-bg disabled:opacity-30">
                <ChevronUp size={17} />
              </button>
              <button
                type="button"
                aria-label={`${e.label} nach unten`}
                title="Nach unten"
                disabled={i === eintraege.length - 1}
                onClick={() => verschieben(i, i + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-bg disabled:opacity-30"
              >
                <ChevronDown size={17} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// „Meine Navigation“: nur die Reihenfolge der Bereiche, die diese Person ohnehin sehen darf
export function MeineNavigation({ start, system, angepasst }: { start: NaviPunkt[]; system: { href: string; label: string }[]; angepasst: boolean }) {
  const router = useRouter();
  const [punkte, setPunkte] = useState(start);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [frage, setFrage] = useState(false);
  const [laeuft, starte] = useTransition();
  const startSchluessel = useMemo(() => JSON.stringify(start.map((p) => [p.href, p.unterpunkte.map((u) => u.href)])), [start]);
  // Neue Grundlage vom Server (gespeichert, zurueckgesetzt, Rechte geaendert): Liste uebernehmen, Meldung bleibt stehen
  const [basis, setBasis] = useState(startSchluessel);
  if (basis !== startSchluessel) {
    setBasis(startSchluessel);
    setPunkte(start);
  }
  const geaendert = JSON.stringify(punkte.map((p) => [p.href, p.unterpunkte.map((u) => u.href)])) !== startSchluessel;
  const reihenfolge = punkte.flatMap((p) => [p.href, ...p.unterpunkte.map((u) => u.href)]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] text-brand-ink-soft">
        Bestimme selbst, in welcher Reihenfolge deine Bereiche erscheinen – am Griff ziehen (am Handy kurz gedrückt halten) oder mit den Pfeilen verschieben. Die Reihenfolge gilt auf all
        deinen Geräten. Welche Bereiche du siehst, ändert sich dadurch nicht.
      </p>
      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-4">
          <section>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Hauptnavigation</h3>
            <SortierListe
              eintraege={punkte.map(({ href, label }) => ({ href, label }))}
              onAendern={(neu) => setPunkte(neu.map((n) => punkte.find((p) => p.href === n.href)!))}
            />
          </section>
          {punkte
            .filter((p) => p.unterpunkte.length > 1)
            .map((p) => (
              <section key={p.href}>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">
                  <Symbol href={p.href} size={14} /> {p.label}
                </h3>
                <SortierListe
                  klein
                  eintraege={p.unterpunkte}
                  onAendern={(neu) => setPunkte((alle) => alle.map((x) => (x.href === p.href ? { ...x, unterpunkte: neu } : x)))}
                />
              </section>
            ))}
          {system.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">System (fest)</h3>
              <ul className="flex flex-col gap-1.5">
                {system.map((s) => (
                  <li key={s.href} className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-brand-line px-3 text-[14px] text-brand-ink-soft">
                    <Lock size={15} /> <Symbol href={s.href} size={16} /> {s.label}
                  </li>
                ))}
                <li className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-brand-line px-3 text-[14px] text-brand-ink-soft">
                  <Lock size={15} /> Support &amp; Hilfe
                </li>
              </ul>
            </section>
          )}
        </div>

        {/* Live-Vorschau */}
        <aside className="flex flex-col gap-3" aria-label="Vorschau">
          <p className="text-[13px] font-semibold text-brand-ink">So wird deine Navigation angezeigt</p>
          <div className="rounded-2xl border border-brand-line bg-white p-2">
            <p className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-brand-ink-faint">
              <Monitor size={13} /> Computer &amp; Tablet
            </p>
            <ul className="flex flex-col gap-0.5">
              {punkte.map((p, i) => (
                <li key={p.href} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${i === 0 ? "bg-brand-red text-white" : "text-brand-ink"}`}>
                  <Symbol href={p.href} size={15} /> <span className="truncate">{p.label}</span>
                </li>
              ))}
              {system.map((s) => (
                <li key={s.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-brand-ink-soft">
                  <Symbol href={s.href} size={15} /> <span className="truncate">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-line bg-white p-2">
            <p className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-brand-ink-faint">
              <Smartphone size={13} /> Handy – untere Leiste
            </p>
            <div className="grid grid-cols-5 gap-1">
              {punkte.slice(0, 4).map((p) => (
                <span key={p.href} className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] text-brand-ink-soft">
                  <Symbol href={p.href} size={17} />
                  <span className="max-w-full truncate px-0.5">{p.label.replace("TanzRaum-", "")}</span>
                </span>
              ))}
              <span className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] text-brand-ink-soft">
                <span className="text-[16px] leading-none">⋯</span>Mehr
              </span>
            </div>
          </div>
        </aside>
      </div>

      {meldung && <Meldung ergebnis={meldung} />}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!geaendert || laeuft}
          onClick={() =>
            starte(async () => {
              const r = await navigationSpeichern(reihenfolge);
              setMeldung(r);
              if (!r.error) router.refresh();
            })
          }
          className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-50"
        >
          <Save size={16} /> Reihenfolge speichern
        </button>
        <button
          type="button"
          disabled={laeuft || (!angepasst && !geaendert)}
          onClick={() => setFrage(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-4 text-[14px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
        >
          <RotateCcw size={16} /> Auf Standard zurücksetzen
        </button>
      </div>

      {frage && (
        <Dialog
          titel="Navigation zurücksetzen?"
          onSchliessen={() => setFrage(false)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFrage(false)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const r = await navigationSpeichern(null);
                    setMeldung(r);
                    setFrage(false);
                    if (!r.error) router.refresh();
                  })
                }
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Zurücksetzen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">Möchtest du deine Navigation wirklich auf die TanzRaum-Standardreihenfolge zurücksetzen?</p>
        </Dialog>
      )}
    </div>
  );
}
